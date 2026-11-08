import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { apiRequest } from "../../lib/api";
import type {
  Category as CatalogCategory,
  SpecificationFieldDefinition,
} from "../../types/catalog";

type SpecificationField = SpecificationFieldDefinition;
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_IMAGES = 8;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

// Categories (with their specification field definitions) come from the API.
type Category = Pick<
  CatalogCategory,
  "id" | "name" | "slug" | "isActive" | "specificationFields" | "parentId"
>;

type Specification = {
  name: string;
  value: string;
};

type ProductVariant = {
  id?: string;
  sku?: string;
  modelNumber?: string | null;
  price?: string | number;
  compareAtPrice?: string | number | null;
  specifications?: Record<string, unknown> | Specification[] | null;
};

type Product = {
  id?: string;
  name?: string;
  sku?: string;
  categoryId?: string;
  brand?: string | null;
  modelNumber?: string | null;
  description?: string | null;
  price?: string | number;
  compareAtPrice?: string | number | null;
  imageUrls?: string[];
  specifications?: Record<string, unknown> | Specification[] | null;
  variants?: ProductVariant[];
  isActive?: boolean;
  isFeatured?: boolean;
  inventory?: { quantity: number; reorderLevel: number } | null;
  salePrice?: string | number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
};

// datetime-local inputs use local time without a zone.
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

type ProductFormValues = {
  id?: string;
  name: string;
  sku: string;
  categoryId: string;
  brand: string;
  modelNumber: string;
  description: string;
  price: string;
  compareAtPrice: string;
  imageUrls: string[];
  specifications: Specification[];
  isActive: boolean;
  isFeatured: boolean;
  salePrice: string;
  saleStartsAt: string;
  saleEndsAt: string;
  stockQuantity: string;
  reorderLevel: string;
};

type ProductFormProps = {
  categories: Category[];
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
};

type UploadedImage = {
  url: string;
  publicId?: string;
};

const emptyForm: ProductFormValues = {
  name: "",
  sku: "",
  categoryId: "",
  brand: "",
  modelNumber: "",
  description: "",
  price: "",
  compareAtPrice: "",
  imageUrls: [],
  specifications: [],
  isActive: true,
  isFeatured: false,
  salePrice: "",
  saleStartsAt: "",
  saleEndsAt: "",
  stockQuantity: "0",
  reorderLevel: "2",
};

// Category fields labelled like these edit the dedicated Brand / Model inputs.
const BRAND_LABELS = ["brand"];
const MODEL_LABELS = ["model", "model number"];

const inputClass =
  "mt-1 w-full rounded-lg border border-[#D9E5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0B6843] focus:ring-2 focus:ring-[#0B6843]/10";

const sectionClass = "space-y-4 rounded-xl border border-[#E2EAE4] p-4";

function specificationsToRows(
  value:
    | Record<string, unknown>
    | Specification[]
    | null
    | undefined,
): Specification[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => ({
      name: String(item?.name ?? ""),
      value: String(item?.value ?? ""),
    }));
  }

  return Object.entries(value).map(([name, value]) => ({
    name,
    value: String(value ?? ""),
  }));
}

export function ProductForm({
  categories,
  product,
  onClose,
  onSaved,
}: ProductFormProps) {
  const [form, setForm] = useState<ProductFormValues>(emptyForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<
    Array<{ file: File; url: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find(
    (category) => category.id === form.categoryId,
  );

  // Specification inputs defined on the category in the admin Categories page.
  const categoryFields: SpecificationField[] = Array.isArray(
    selectedCategory?.specificationFields,
  )
    ? selectedCategory.specificationFields
    : [];

  // Only active categories can receive products; keep the current one listed.
  const selectableCategories = categories.filter(
    (category) => category.isActive || category.id === product?.categoryId,
  );

  useEffect(() => {
    setSelectedFiles([]);
    setError("");

    if (!product) {
      setForm({ ...emptyForm });
      return;
    }

    const firstVariant = product.variants?.[0];

    const allSpecs = specificationsToRows(
      firstVariant?.specifications ?? product.specifications,
    );

    const getSpec = (key: string) =>
      allSpecs.find(
        (item) => item.name.toLowerCase() === key.toLowerCase(),
      )?.value ?? "";

    setForm({
      ...emptyForm,
      id: product.id,
      name: product.name ?? "",
      sku: firstVariant?.sku ?? product.sku ?? "",
      categoryId: product.categoryId ?? "",
      brand: product.brand ?? getSpec("Brand"),
      modelNumber:
        firstVariant?.modelNumber ??
        product.modelNumber ??
        getSpec("Model"),
      description: product.description ?? "",
      price: String(firstVariant?.price ?? product.price ?? ""),
      compareAtPrice: String(
        firstVariant?.compareAtPrice ?? product.compareAtPrice ?? "",
      ),
      imageUrls: product.imageUrls?.filter(Boolean) ?? [],
      specifications: allSpecs.filter(
        (item) =>
          !["brand", "model"].includes(item.name.toLowerCase()),
      ),
      isActive: product.isActive ?? true,
      isFeatured: product.isFeatured ?? false,
      salePrice: product.salePrice ? String(Number(product.salePrice)) : "",
      saleStartsAt: toLocalInput(product.saleStartsAt),
      saleEndsAt: toLocalInput(product.saleEndsAt),
      stockQuantity: String(product.inventory?.quantity ?? 0),
      reorderLevel: String(product.inventory?.reorderLevel ?? 2),
    });
  }, [product]);

  useEffect(() => {
    const previews = selectedFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setImagePreviews(previews);

    return () => {
      previews.forEach((preview) =>
        URL.revokeObjectURL(preview.url),
      );
    };
  }, [selectedFiles]);

  function updateField<K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateCategorySpecification(name: string, value: string) {
    setForm((current) => {
      const exists = current.specifications.some(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );

      return {
        ...current,
        specifications: exists
          ? current.specifications.map((item) =>
              item.name.toLowerCase() === name.toLowerCase()
                ? { ...item, name, value }
                : item,
            )
          : [...current.specifications, { name, value }],
      };
    });
  }

  function handleImageSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);

    setError("");

    if (!files.length) return;

    const invalidFile = files.find(
      (file) =>
        !ALLOWED_IMAGE_TYPES.includes(file.type) ||
        file.size > MAX_IMAGE_SIZE,
    );

    if (invalidFile) {
      setError(
        `${invalidFile.name}: choose a JPG, PNG, WebP or AVIF image under 15 MB.`,
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((current) => {
      const combined = [...current, ...files];

      if (combined.length + form.imageUrls.length > MAX_IMAGES) {
        setError(`You can attach a maximum of ${MAX_IMAGES} images.`);
        return current;
      }

      return combined;
    });

    event.target.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) =>
      current.filter((_, i) => i !== index),
    );
  }

  function removeExistingImage(urlToRemove: string) {
    setForm((current) => ({
      ...current,
      imageUrls: current.imageUrls.filter(
        (url) => url !== urlToRemove,
      ),
    }));
  }

  function updateSpecification(
    index: number,
    field: keyof Specification,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      specifications: current.specifications.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addSpecification() {
    setForm((current) => ({
      ...current,
      specifications: [
        ...current.specifications,
        { name: "", value: "" },
      ],
    }));
  }

  function removeSpecification(index: number) {
    setForm((current) => ({
      ...current,
      specifications: current.specifications.filter(
        (_, i) => i !== index,
      ),
    }));
  }

  async function uploadSelectedImages(): Promise<UploadedImage[]> {
    if (!selectedFiles.length) return [];

    const uploadData = new FormData();

    selectedFiles.forEach((file) => {
      uploadData.append("images", file);
    });

    setUploadingImages(true);

    try {
      let result: { data: UploadedImage[] };

      try {
        result = await apiRequest<{ data: UploadedImage[] }>("/api/uploads", {
          method: "POST",
          body: uploadData,
          auth: true,
        });
      } catch (err) {
        throw new Error(
          `Image upload failed: ${err instanceof Error ? err.message : "unknown error"} The product was not saved.`,
        );
      }

      const uploaded = Array.isArray(result.data) ? result.data : [];

      if (
        uploaded.length !== selectedFiles.length ||
        uploaded.some(
          (image) => typeof image.url !== "string" || !image.url,
        )
      ) {
        throw new Error(
          "The image service returned an incomplete result.",
        );
      }

      return uploaded;
    } finally {
      setUploadingImages(false);
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    if (
      !form.name.trim() ||
      !form.sku.trim() ||
      !form.categoryId
    ) {
      setError("Enter a product name, SKU and category.");
      return;
    }

    const price = Number(form.price);

    const compareAtPrice =
      form.compareAtPrice.trim() === ""
        ? null
        : Number(form.compareAtPrice);

    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid selling price greater than zero.");
      return;
    }

    if (
      compareAtPrice !== null &&
      (!Number.isFinite(compareAtPrice) ||
        compareAtPrice <= price)
    ) {
      setError(
        "Compare-at (old) price must be higher than the selling price, or left empty.",
      );
      return;
    }

    if (form.salePrice !== "" && (!(Number(form.salePrice) > 0) || Number(form.salePrice) >= price)) {
      setError("Sale price must be lower than the selling price.");
      return;
    }
    if (form.salePrice !== "" && !form.saleEndsAt) {
      setError("Give the flash sale an end date and time.");
      return;
    }

    const stockQuantity = Number(form.stockQuantity);
    const reorderLevel = Number(form.reorderLevel);

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setError("Stock quantity must be a whole number of 0 or more.");
      return;
    }

    if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
      setError("Reorder level must be a whole number of 0 or more.");
      return;
    }

    const missingField = categoryFields.find(
      (field) => field.required && !getFieldValue(field).trim(),
    );

    if (missingField) {
      setError(`${missingField.label} is required for this category.`);
      return;
    }

    const existingImageUrls = form.imageUrls
      .map((url) => url.trim())
      .filter(Boolean);

    if (
      existingImageUrls.some(
        (url) => !/^(https?:\/\/\S+|\/[^/]\S*)$/i.test(url),
      )
    ) {
      setError("An existing product image URL is invalid.");
      return;
    }

    if (
      existingImageUrls.length + selectedFiles.length >
      MAX_IMAGES
    ) {
      setError(
        `A product can have a maximum of ${MAX_IMAGES} images.`,
      );
      return;
    }

    const specifications: Record<string, string> = {};

    if (form.brand.trim()) {
      specifications.Brand = form.brand.trim();
    }

    if (form.modelNumber.trim()) {
      specifications.Model = form.modelNumber.trim();
    }

    form.specifications.forEach(({ name, value }) => {
      if (name.trim() && value.trim()) {
        specifications[name.trim()] = value.trim();
      }
    });

    setSaving(true);

    try {
      const uploadedImages = await uploadSelectedImages();

      const imageUrls = [
        ...existingImageUrls,
        ...uploadedImages.map((image) => image.url),
      ];

      const categoryChanged =
        !form.id || form.categoryId !== product?.categoryId;

      await apiRequest(`/api/products${form.id ? `/${form.id}` : ""}`, {
        method: form.id ? "PUT" : "POST",
        auth: true,
        body: {
          name: form.name.trim(),
          sku: form.sku.trim(),
          // Sent only when changed, so a product in a since-deactivated
          // category can still be edited.
          ...(categoryChanged ? { categoryId: form.categoryId } : {}),
          description: form.description.trim() || null,
          price,
          compareAtPrice,
          imageUrls,
          specifications,
          modelNumber: form.modelNumber.trim() || null,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          salePrice: form.salePrice === "" ? null : Number(form.salePrice),
          saleStartsAt: form.saleStartsAt ? new Date(form.saleStartsAt).toISOString() : null,
          saleEndsAt: form.saleEndsAt ? new Date(form.saleEndsAt).toISOString() : null,
          stockQuantity,
          reorderLevel,
        },
      });

      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the product.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Values for category fields are saved in Product.specifications under the
  // field's label, matching how existing products store their specifications.
  function getFieldValue(field: SpecificationField): string {
    const label = field.label.toLowerCase();
    if (BRAND_LABELS.includes(label)) return form.brand;
    if (MODEL_LABELS.includes(label)) return form.modelNumber;

    return (
      form.specifications.find(
        (item) => item.name.toLowerCase() === label,
      )?.value ?? ""
    );
  }

  function setFieldValue(field: SpecificationField, value: string) {
    const label = field.label.toLowerCase();
    if (BRAND_LABELS.includes(label)) return updateField("brand", value);
    if (MODEL_LABELS.includes(label)) return updateField("modelNumber", value);
    updateCategorySpecification(field.label, value);
  }

  function renderCategoryField(field: SpecificationField) {
    const value = getFieldValue(field);
    const id = `spec-${field.key}`;
    const label = (
      <>
        {field.label}
        {field.required && " *"}
      </>
    );

    return (
      <div
        key={field.key}
        className={`text-sm font-medium text-[#17241C] ${
          field.type === "textarea" ? "sm:col-span-2" : ""
        }`}
      >
        <label htmlFor={id}>{label}</label>

        {field.type === "select" || field.type === "boolean" ? (
          <select
            id={id}
            className={inputClass}
            required={field.required}
            value={value}
            onChange={(event) => setFieldValue(field, event.target.value)}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {(field.type === "boolean" ? ["Yes", "No"] : field.options ?? []).map(
              (option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ),
            )}
            {/* Keep a value saved before the options changed. */}
            {value &&
              field.type === "select" &&
              !(field.options ?? []).includes(value) && (
                <option value={value}>{value}</option>
              )}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            id={id}
            rows={3}
            maxLength={2000}
            className={inputClass}
            required={field.required}
            value={value}
            onChange={(event) => setFieldValue(field, event.target.value)}
          />
        ) : (
          <div className="relative">
            <input
              id={id}
              className={`${inputClass} ${field.unit ? "pr-16" : ""}`}
              type={field.type === "number" ? "number" : "text"}
              step={field.type === "number" ? "any" : undefined}
              min={field.type === "number" ? "0" : undefined}
              required={field.required}
              value={value}
              onChange={(event) => setFieldValue(field, event.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />

            {field.unit && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64756A]">
                {field.unit}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="my-3 w-full max-w-3xl rounded-2xl bg-white shadow-xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-[#D9E5DD] bg-white p-5">
          <div>
            <h2
              id="product-form-title"
              className="text-lg font-semibold text-[#17241C]"
            >
              {form.id ? "Edit product" : "Add product"}
            </h2>

            <p className="mt-1 text-sm text-[#64756A]">
              Manage catalogue information for the storefront.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close form"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-[#64756A] hover:bg-[#F5F8F6] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-5"
        >
          <section className={sectionClass}>
            <h3 className="font-semibold text-[#17241C]">
              Basic information
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#17241C]">
                Product name *
                <input
                  required
                  maxLength={150}
                  className={inputClass}
                  value={form.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                />
              </label>

              <label className="text-sm font-medium text-[#17241C]">
                Category *
                <select
                  required
                  className={inputClass}
                  value={form.categoryId}
                  onChange={(event) =>
                    updateField("categoryId", event.target.value)
                  }
                >
                  <option value="">Select category</option>

                  {selectableCategories.map((category) => {
                    const parent = categories.find((entry) => entry.id === category.parentId);
                    return (
                      <option key={category.id} value={category.id}>
                        {parent ? `${parent.name} › ` : ""}
                        {category.name}
                        {!category.isActive && " (inactive)"}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="text-sm font-medium text-[#17241C]">
                Brand
                <input
                  maxLength={100}
                  className={inputClass}
                  value={form.brand}
                  onChange={(event) =>
                    updateField("brand", event.target.value)
                  }
                  placeholder="e.g. Roch"
                />
              </label>

              <label className="text-sm font-medium text-[#17241C]">
                Model number
                <input
                  maxLength={100}
                  className={inputClass}
                  value={form.modelNumber}
                  onChange={(event) =>
                    updateField("modelNumber", event.target.value)
                  }
                  placeholder="Manufacturer's model"
                />
              </label>

              <label className="text-sm font-medium text-[#17241C] sm:col-span-2">
                Description
                <textarea
                  rows={4}
                  maxLength={5000}
                  className={inputClass}
                  value={form.description}
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value,
                    )
                  }
                  placeholder="Describe the product and its key features."
                />
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="font-semibold text-[#17241C]">
              Pricing and variant
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#17241C]">
                SKU *
                <input
                  required
                  maxLength={100}
                  className={inputClass}
                  value={form.sku}
                  onChange={(event) =>
                    updateField("sku", event.target.value)
                  }
                  placeholder="e.g. ROCH-RFR-120S-I"
                />
              </label>

              <label className="text-sm font-medium text-[#17241C]">
                Selling price (UGX) *
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                  value={form.price}
                  onChange={(event) =>
                    updateField("price", event.target.value)
                  }
                />
              </label>

              <label className="text-sm font-medium text-[#17241C]">
                Compare-at price (UGX)
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={form.compareAtPrice}
                  onChange={(event) =>
                    updateField(
                      "compareAtPrice",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <div>
              <h3 className="font-semibold text-[#17241C]">Flash sale</h3>
              <p className="mt-1 text-xs text-[#64756A]">
                Optional. While the sale runs, customers pay the sale price and
                see a countdown. Leave the price empty for no sale.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-[#17241C]">
                Sale price (UGX)
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  value={form.salePrice}
                  onChange={(event) => updateField("salePrice", event.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-[#17241C]">
                Starts
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.saleStartsAt}
                  onChange={(event) => updateField("saleStartsAt", event.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-[#17241C]">
                Ends
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.saleEndsAt}
                  onChange={(event) => updateField("saleEndsAt", event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <div>
              <h3 className="font-semibold text-[#17241C]">Inventory</h3>
              <p className="mt-1 text-xs text-[#64756A]">
                Units on hand. Orders reduce this automatically; orders placed
                at 0 stock are saved as Awaiting Stock.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#17241C]">
                Stock quantity *
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={form.stockQuantity}
                  onChange={(event) =>
                    updateField("stockQuantity", event.target.value)
                  }
                />
              </label>

              <label className="text-sm font-medium text-[#17241C]">
                Low-stock alert at
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={form.reorderLevel}
                  onChange={(event) =>
                    updateField("reorderLevel", event.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <div>
              <h3 className="font-semibold text-[#17241C]">
                Product images
              </h3>

              <p className="mt-1 text-xs text-[#64756A]">
                New images upload when you save. The first
                image is the main image.
              </p>
            </div>

            {form.imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {form.imageUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="relative"
                  >
                    <img
                      src={url}
                      alt={`Product image ${index + 1}`}
                      className="h-28 w-full rounded-lg border border-[#D9E5DD] object-cover"
                    />

                    <button
                      type="button"
                      aria-label={`Remove existing image ${index + 1}`}
                      onClick={() =>
                        removeExistingImage(url)
                      }
                      disabled={saving}
                      className="absolute right-1 top-1 rounded-full bg-white p-1.5 text-red-600 shadow disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              onChange={handleImageSelection}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#B8D3C1] px-5 py-8 text-center hover:bg-[#F5F8F6] disabled:opacity-50"
            >
              <ImagePlus
                size={30}
                className="mb-2 text-[#0B6843]"
              />

              <span className="text-sm font-semibold text-[#17241C]">
                Choose product images
              </span>

              <span className="mt-1 text-xs text-[#64756A]">
                JPG, PNG, WebP or AVIF · Up to 15 MB each ·
                Maximum 8 images
              </span>
            </button>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {imagePreviews.map((preview, index) => (
                  <div
                    key={`${preview.file.name}-${index}`}
                    className="relative"
                  >
                    <img
                      src={preview.url}
                      alt={`Preview of ${preview.file.name}`}
                      className="h-28 w-full rounded-lg border border-[#D9E5DD] object-cover"
                    />

                    <button
                      type="button"
                      aria-label={`Remove selected image ${index + 1}`}
                      onClick={() =>
                        removeSelectedFile(index)
                      }
                      disabled={saving}
                      className="absolute right-1 top-1 rounded-full bg-white p-1.5 text-red-600 shadow disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>

                    <p className="mt-1 truncate text-xs text-[#64756A]">
                      {preview.file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={sectionClass}>
            <div>
              <h3 className="font-semibold text-[#17241C]">
                Specifications
              </h3>

              <p className="mt-1 text-xs text-[#64756A]">
                {selectedCategory
                  ? `Fields configured for ${selectedCategory.name}. You can also add your own fields below.`
                  : "Choose a category to see its specification fields."}
              </p>
            </div>

            {categoryFields.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {categoryFields.map(renderCategoryField)}
              </div>
            ) : (
              <p className="rounded-lg bg-[#F5F8F6] p-3 text-sm text-[#64756A]">
                No specification fields are configured for this
                category yet. Add them under Categories, or use
                Additional specifications below.
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-[#17241C]">
                  Additional specifications
                </h4>

                <button
                  type="button"
                  onClick={addSpecification}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm"
                >
                  <Plus size={15} />
                  Add field
                </button>
              </div>

              {form.specifications
                .map((specification, index) => ({
                  specification,
                  index,
                }))
                .filter(
                  ({ specification }) =>
                    !categoryFields.some(
                      (field) =>
                        field.label.toLowerCase() ===
                        specification.name.toLowerCase(),
                    ) &&
                    !["brand", "model"].includes(
                      specification.name.toLowerCase(),
                    ),
                )
                .map(({ specification, index }) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                  >
                    <label className="text-sm">
                      Specification
                      <input
                        className={inputClass}
                        value={specification.name}
                        onChange={(event) =>
                          updateSpecification(
                            index,
                            "name",
                            event.target.value,
                          )
                        }
                        placeholder="e.g. Energy rating"
                      />
                    </label>

                    <label className="text-sm">
                      Value
                      <input
                        className={inputClass}
                        value={specification.value}
                        onChange={(event) =>
                          updateSpecification(
                            index,
                            "value",
                            event.target.value,
                          )
                        }
                        placeholder="e.g. A"
                      />
                    </label>

                    <button
                      type="button"
                      aria-label={`Remove specification ${index + 1}`}
                      onClick={() =>
                        removeSpecification(index)
                      }
                      className="mb-0.5 rounded-lg border border-[#D9E5DD] p-2 text-[#64756A]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="font-semibold text-[#17241C]">
              Storefront visibility
            </h3>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-[#17241C]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    updateField(
                      "isActive",
                      event.target.checked,
                    )
                  }
                />
                Active — visible on the public website
              </label>

              <label className="flex items-center gap-2 text-sm text-[#17241C]">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) =>
                    updateField(
                      "isFeatured",
                      event.target.checked,
                    )
                  }
                />
                Featured product
              </label>
            </div>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-[#D9E5DD] bg-white pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[#D9E5DD] px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#064E32] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B6843] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <UploadCloud
                    size={16}
                    className="animate-pulse"
                  />
                  {uploadingImages
                    ? "Uploading images…"
                    : "Saving…"}
                </>
              ) : form.id ? (
                "Save changes"
              ) : (
                "Add product"
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}