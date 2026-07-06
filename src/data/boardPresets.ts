export type BoardPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  beadSize?: "2.6mm" | "5mm" | "custom";
  description?: string;
};

export const boardPresets: BoardPreset[] = [
  { id: "mini-52", label: "小豆 52×52", width: 52, height: 52, beadSize: "2.6mm", description: "常見小豆方板" },
  { id: "mini-104", label: "小豆 104×104", width: 104, height: 104, beadSize: "2.6mm", description: "大型小豆板" },
  { id: "mini-78", label: "小豆 78×78", width: 78, height: 78, beadSize: "2.6mm", description: "中大型小豆板" },
  { id: "midi-29", label: "大豆 29×29", width: 29, height: 29, beadSize: "5mm", description: "Perler / Hama 常見方板" },
  { id: "midi-58", label: "大豆 58×58", width: 58, height: 58, beadSize: "5mm", description: "4 片 29×29 拼接" },
  { id: "small-16", label: "小掛件 16×16", width: 16, height: 16, beadSize: "custom" },
  { id: "small-24", label: "小圖 24×24", width: 24, height: 24, beadSize: "custom" },
  { id: "medium-32", label: "中圖 32×32", width: 32, height: 32, beadSize: "custom" },
  { id: "medium-40", label: "中大圖 40×40", width: 40, height: 40, beadSize: "custom" }
];
