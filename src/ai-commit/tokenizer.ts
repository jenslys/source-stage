import {
  decode as decodeO200kBase,
  encode as encodeO200kBase,
} from "gpt-tokenizer/encoding/o200k_base"
import {
  decode as decodeO200kHarmony,
  encode as encodeO200kHarmony,
} from "gpt-tokenizer/encoding/o200k_harmony"

export type TextTokenizer = {
  encode: (text: string) => number[]
  decode: (tokens: number[]) => string
}

export function resolveTokenizer(model: string): TextTokenizer {
  const normalizedModel = model.trim().toLowerCase()
  if (normalizedModel.startsWith("gpt-oss") || normalizedModel.includes("harmony")) {
    return {
      encode: encodeO200kHarmony,
      decode: decodeO200kHarmony,
    }
  }

  return {
    encode: encodeO200kBase,
    decode: decodeO200kBase,
  }
}
