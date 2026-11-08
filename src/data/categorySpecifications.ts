export type SpecificationField = {
  name: string;
  type?: "text" | "select" | "number";
  options?: string[];
  unit?: string;
};

export const categorySpecifications: Record<string, SpecificationField[]> = {
  televisions: [
    { name: "Screen Size", type: "number", unit: "inches" },
    {
      name: "Resolution",
      type: "select",
      options: ["HD", "Full HD", "4K UHD", "8K UHD"],
    },
    {
      name: "Display Technology",
      type: "select",
      options: ["LED", "OLED", "QLED", "Mini LED"],
    },
    { name: "Smart TV", type: "select", options: ["Yes", "No"] },
    { name: "Refresh Rate", type: "number", unit: "Hz" },
    { name: "Operating System" },
  ],

  refrigerators: [
    { name: "Capacity", type: "number", unit: "litres" },
    {
      name: "Defrost Type",
      type: "select",
      options: ["Manual", "Frost Free", "Automatic"],
    },
    { name: "Energy Rating" },
    {
      name: "Door Type",
      type: "select",
      options: ["Single Door", "Double Door", "Side by Side", "French Door"],
    },
  ],

  "washing-machines": [
    { name: "Capacity", type: "number", unit: "kg" },
    {
      name: "Type",
      type: "select",
      options: ["Front Load", "Top Load", "Semi Automatic"],
    },
    { name: "Spin Speed", type: "number", unit: "RPM" },
    { name: "Energy Rating" },
  ],

  laptops: [
    { name: "Processor" },
    { name: "RAM", type: "number", unit: "GB" },
    { name: "Storage" },
    { name: "Screen Size", type: "number", unit: "inches" },
    { name: "Graphics Card" },
    { name: "Operating System" },
  ],

  phones: [
    { name: "RAM", type: "number", unit: "GB" },
    { name: "Storage" },
    { name: "Screen Size", type: "number", unit: "inches" },
    { name: "Battery Capacity", type: "number", unit: "mAh" },
    { name: "Camera" },
    { name: "Operating System" },
  ],
};

export function getCategorySpecifications(
  categoryName: string,
  categorySlug?: string,
): SpecificationField[] {
  const key = (categorySlug || categoryName)
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");

  const aliases: Record<string, string> = {
    television: "televisions",
    tv: "televisions",
    "smart-tv": "televisions",
    fridge: "refrigerators",
    refrigerator: "refrigerators",
    "washing-machine": "washing-machines",
    laptop: "laptops",
    "mobile-phones": "phones",
    "mobile-phone": "phones",
    smartphone: "phones",
  };

  return categorySpecifications[aliases[key] || key] ?? [];
}