// Model metadata shared between the engine UI and the inference worker.

export const DEFAULT_MODEL_ID = "onnx-community/whisper-tiny.en";

export const MODELS = [
  {
    id: DEFAULT_MODEL_ID,
    label: "tiny.en - English only, fastest (~40 MB)",
    multilingual: false,
  },
  {
    id: "onnx-community/whisper-tiny",
    label: "tiny - multilingual (~40 MB)",
    multilingual: true,
  },
  {
    id: "onnx-community/whisper-base.en",
    label: "base.en - English only, better accuracy (~75 MB)",
    multilingual: false,
  },
  {
    id: "onnx-community/whisper-base",
    label: "base - multilingual, better accuracy (~75 MB)",
    multilingual: true,
  },
];
