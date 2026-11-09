#!/usr/bin/env python3
"""
Gera ble/__fixtures__/vetores.json passando bytes pelo decodificador DO
BACKEND (telemetria-desktop/backend/telemetria/servicos/leitor.py).

O teste do app (ble/protocolo.test.ts) passa os mesmos bytes pelo
protocolo.ts e exige o mesmo resultado: e assim que se prova que o celular
le o ESP32 igual ao computador, sem precisar dos dois ligados.

Uso, com o repositorio do TCC clonado ao lado:
    python ferramentas/gerar_vetores.py ../ODB2-MS41-Telemetry/telemetria-desktop/backend
"""

import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else "../ODB2-MS41-Telemetry/telemetria-desktop/backend")

from telemetria.modelos import BITS_EXTRAS, VALID_COMPLETO  # noqa: E402
from telemetria.servicos.leitor import MontadorDeLinha, decodificar  # noqa: E402

random.seed(41)


def linha_firmware(t: float, com_extras: bool = True) -> dict:
    """Uma leitura no formato do firmware (chave "t", nao "t_ms"), com os
    numeros do LeitorSimulado do backend."""
    rpm = 800 + max(0.0, math.sin(t / 9.0)) ** 3 * 5800 + random.uniform(-40, 40)
    tps = max(0.0, min(100.0, (rpm - 750) / 62.0))
    d = {
        "t": int(t * 1000),
        "rpm": int(rpm),
        "ect": int(85 + random.uniform(-3, 3)),
        "iat": int(28 + math.sin(t / 30.0) * 3),
        "vbat": round(13.9 + random.uniform(-0.06, 0.06), 2),
        "tps": round(tps, 1),
        "vanos": round(8.0 if rpm < 1500 else min(96.0, 8 + (rpm - 1500) / 55.0), 1),
        "vss": int(max(0.0, (rpm - 900) / 38.0)),
    }
    valid = VALID_COMPLETO
    if com_extras:
        d.update(
            {
                "load": round(130 + tps * 4.8, 1),
                "maf": round(12 + rpm / 12.0, 1),
                "mafv": round(1.2 + rpm / 4000.0, 2),
                "knock": -1.5 if random.random() < 0.1 else 0.0,
                "ign": round(12 + min(rpm, 4500) / 4500 * 22, 1),
                "inj": round(2.4 + tps * 0.09, 2),
                "iacv": round(max(0.0, 28 - (rpm - 750) / 100.0), 1),
                "lint1": round(random.uniform(-4, 4), 1),
                "lint2": round(random.uniform(-4, 4), 1),
                "lam1": round(0.5 + 0.4 * math.sin(t * 2.1), 2),
                "lam2": round(0.5 + 0.4 * math.sin(t * 1.9 + 1.0), 2),
            }
        )
        valid |= sum(BITS_EXTRAS.values())
    if random.random() < 0.2:  # a central deixou de responder um campo
        valid &= ~random.choice([0x04, 0x08, 0x40, BITS_EXTRAS["maf"]])
    d["valid"] = valid
    return d


def fluxo(linhas: list[str], fim: bytes = b"\n") -> bytes:
    return b"".join(l.encode() + fim for l in linhas)


def fatiar(dados: bytes, tamanhos) -> list[list[int]]:
    pedacos, i = [], 0
    for n in tamanhos:
        if i >= len(dados):
            break
        pedacos.append(list(dados[i : i + n]))
        i += n
    return pedacos


def caso(nome: str, pedacos: list[list[int]]) -> dict:
    """Roda os pedacos pelo backend e anota o que ele produziu."""
    montador = MontadorDeLinha()
    esperado = []
    for p in pedacos:
        for linha in montador.alimentar(bytes(p)):
            esperado.append({"linha": linha, "amostra": decodificar(linha)})
    return {"nome": nome, "pedacos": pedacos, "esperado": esperado}


def main() -> None:
    sep = (",", ":")
    novas = [json.dumps(linha_firmware(i * 0.2), separators=sep) for i in range(40)]
    antigas = [json.dumps(linha_firmware(i * 0.2, com_extras=False), separators=sep) for i in range(10)]
    lixo = ["lixo", '{"rpm":800}', "[1,2,3]", '{"t":1,"rpm":8', "   "]

    casos = [
        caso("firmware atual, pedacos de 20 bytes (MTU padrao)", fatiar(fluxo(novas), [20] * 10_000)),
        caso("firmware antigo, sem os extras", fatiar(fluxo(antigas), [20] * 10_000)),
        caso("fim de linha CRLF", fatiar(fluxo(novas[:8], b"\r\n"), [20] * 10_000)),
        caso(
            "pedacos de tamanho aleatorio (1 a 64 bytes)",
            fatiar(fluxo(novas), [random.randint(1, 64) for _ in range(10_000)]),
        ),
        caso("lixo no meio do fluxo", fatiar(fluxo(novas[:5] + lixo + novas[5:10]), [20] * 10_000)),
        caso(
            "conexao abre no meio de uma linha",
            fatiar(fluxo(novas[:6])[37:], [20] * 10_000),
        ),
    ]
    destino = Path(__file__).resolve().parents[1] / "ble" / "__fixtures__" / "vetores.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps({"gerado_por": "backend/telemetria/servicos/leitor.py", "casos": casos}))
    total = sum(len(c["esperado"]) for c in casos)
    print(f"{len(casos)} casos, {total} linhas -> {destino}")


if __name__ == "__main__":
    main()
