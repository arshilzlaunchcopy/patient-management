import { ageFromDob } from "@/lib/dates";
import type { Patient } from "@/lib/types";

const SEX_LABEL: Record<NonNullable<Patient["sex"]>, string> = {
  M: "Male",
  F: "Female",
  Other: "Other",
};

/** "58 / M", "F", "62", or "" when nothing is known. */
export function ageSexLabel(p: {
  sex: Patient["sex"];
  date_of_birth: string | null;
  age_years: number | null;
}): string {
  const age = ageFromDob(p.date_of_birth) ?? p.age_years;
  const parts: string[] = [];
  if (age !== null && age !== undefined) parts.push(String(age));
  if (p.sex) parts.push(p.sex);
  return parts.join(" / ");
}

export function sexLabel(sex: Patient["sex"]): string {
  return sex ? SEX_LABEL[sex] : "";
}
