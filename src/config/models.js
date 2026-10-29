const MODELS = [
  {
    id: "onnx-community/whisper-tiny.en",
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

export default MODELS;
