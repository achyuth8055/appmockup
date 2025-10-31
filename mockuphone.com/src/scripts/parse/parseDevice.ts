import * as fs from "fs";
import { SafeParseReturnType, SafeParseSuccess, z } from "zod";

const HEX_CODE_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/; // ref https://stackoverflow.com/a/1636354/19287186
const RawDevice = z.object({
  credits: z.string(),
  color_str: z.string(),
  meta_title: z.string(),
  meta_description: z.string(),
  display_resolution: z.tuple([z.number(), z.number()]),
  device_type: z.string(),
  device_id: z.string(),
  name: z.string(),
  short_name: z.optional(z.string()),
  orientations: z
    .object({
      alt: z.string(),
      name: z.string(),
      legacy_file: z.optional(z.string()),
      coords: z.tuple([
        z.tuple([z.number(), z.number()]),
        z.tuple([z.number(), z.number()]),
        z.tuple([z.number(), z.number()]),
        z.tuple([z.number(), z.number()]),
      ]),
      template_image_size: z.tuple([z.number(), z.number()]).optional(),
    })
    .array(),
  available_perspectives: z.array(z.string()),
  is_mockup_image_at_front: z.optional(z.boolean()),
  is_legacy: z.optional(z.boolean()).default(false),

  // new fields
  color: z
    .object({
      id: z.string(),
      name: z.string(),
      hexcode: z.string().regex(HEX_CODE_REGEX),
    })
    .nullable(),
});

export type RawDevice = z.infer<typeof RawDevice>;

export function parseRawDevicesFile(url: string): RawDevice[] {
  const jsonString = fs.readFileSync(url, "utf-8");
  const jsonData = JSON.parse(jsonString);

  return parseRawDevice(jsonData.devices);
}

function parseRawDevice(data: any): RawDevice[] {
  return data
    .map((device: any) => {
      const parsed = RawDevice.safeParse(device);
      if (!parsed.success) {
        console.error(parsed.error);
      }
      return parsed;
    })
    .filter((parsed: SafeParseReturnType<any, RawDevice>) => parsed.success)
    .map((parsed: SafeParseSuccess<RawDevice>) => parsed.data);
}
