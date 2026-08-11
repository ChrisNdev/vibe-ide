import assert from 'assert'
import { treemap, fitLabel, LABEL_FONT_SIZE, LABEL_PAD_X, LABEL_BASELINE, type Rect } from './treemapLayout'

/**
 * A invariante que importa: o label desenhado nunca é mais largo que o retângulo dele. Era
 * exatamente isso que faltava — o corte era num limite fixo de caracteres, sem olhar a largura
 * disponível, e o texto atravessava por cima dos vizinhos. Um off-by-one no corte traz o bug
 * de volta sem quebrar mais nada, então vale a checagem. Rode com `npm test`.
 */

/** Mesma métrica que fitLabel usa pra decidir — se as duas discordarem, é o teste que está errado. */
const CHAR_ADVANCE = 0.62
function renderedWidth(text: string): number {
  return text.length * LABEL_FONT_SIZE * CHAR_ADVANCE
}

function rect(w: number, h: number): Rect {
  return { x: 0, y: 0, w, h }
}

const TALL = LABEL_BASELINE + 3

// Cabe inteiro: nada de reticências gratuitas.
assert.strictEqual(fitLabel('App.tsx', rect(300, TALL)), 'App.tsx')

// Não cabe: corta e marca o corte.
const tight = fitLabel('UpdateChecker.tsx', rect(60, TALL))
assert.ok(tight, 'um retângulo de 60 de largura ainda comporta algum texto')
assert.ok(tight.endsWith('…'), 'texto cortado tem que sinalizar o corte')
assert.ok(tight.length < 'UpdateChecker.tsx'.length, 'texto cortado é mais curto que o original')

// A invariante, varrida numa faixa de larguras e nomes reais do próprio projeto.
const names = ['a.ts', 'App.tsx', 'ControlStrip.tsx', 'UpdateChecker.tsx', 'transcript-tailer.ts', 'background-processor.ts']
for (let w = 4; w <= 400; w += 1) {
  for (const name of names) {
    const fitted = fitLabel(name, rect(w, TALL))
    if (fitted === null) continue
    const available = w - LABEL_PAD_X * 2
    assert.ok(
      renderedWidth(fitted) <= available,
      `"${fitted}" (${renderedWidth(fitted).toFixed(1)}) vazou de um retângulo de ${w} (disponível ${available})`
    )
  }
}

// Retângulo baixo demais: o texto sairia por cima/baixo das bordas, então não desenha nada.
assert.strictEqual(fitLabel('App.tsx', rect(300, LABEL_BASELINE + 2)), null)
// Estreito demais pra qualquer coisa legível.
assert.strictEqual(fitLabel('App.tsx', rect(10, TALL)), null)

// O treemap em si: sem sobreposição e sem retângulo degenerado — é o que garante que o único
// jeito de dois nomes se encavalarem é o texto vazar.
const rects = [...treemap(
  Array.from({ length: 40 }, (_, i) => ({ id: `f${i}`, weight: (i % 7) + 1 })),
  0, 0, 1000, 700
).values()]
assert.strictEqual(rects.length, 40)
for (const r of rects) assert.ok(r.w > 0 && r.h > 0, 'todo retângulo tem área')
// Bordas encostadas caem em ~1e-13 de sobreposição por acúmulo de ponto flutuante nas divisões
// recursivas — invisível em qualquer zoom. A tolerância é pra isso; qualquer sobreposição de
// verdade é ordens de grandeza maior.
const EPSILON = 1e-9
for (let i = 0; i < rects.length; i++) {
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i]
    const b = rects[j]
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    assert.ok(
      overlapX <= EPSILON || overlapY <= EPSILON,
      `retângulos ${i} e ${j} se sobrepõem em ${overlapX.toFixed(3)}x${overlapY.toFixed(3)}`
    )
  }
}

console.log('treemapLayout: ok')
