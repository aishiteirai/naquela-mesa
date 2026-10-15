"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuOptionGroup, MenuProduct } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";

const SINGLE_FLAVOR = "single";
const NO_OPTION = "none";

function SectionTitle({ id, title, rule }: { id: string; title: string; rule: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 id={id} className="font-semibold">
        {title}
      </h3>
      <Badge variant="secondary">{rule}</Badge>
    </div>
  );
}

function OptionRow({ id, label, price, disabled, children }: { id: string; label: string; price?: string; disabled?: boolean; children: ReactNode }) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 font-normal has-data-checked:border-primary has-data-checked:bg-primary/5",
        disabled && "text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-3">
        {children}
        <span>{label}</span>
      </span>
      {price && <span className="text-sm text-muted-foreground">{price}</span>}
    </Label>
  );
}

export function SizeSection({
  sizes,
  product,
  value,
  onChange,
}: {
  sizes: MenuCategory["sizes"];
  product: MenuProduct;
  value: string;
  onChange: (sizeId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle id="item-size-title" title="Tamanho" rule="Obrigatório" />
      <RadioGroup value={value} onValueChange={onChange} aria-labelledby="item-size-title">
        {sizes.map((size) => {
          const price = product.sizePrices.find((candidate) => candidate.sizeId === size.id)!.priceCents;
          const id = `size-${size.id}`;
          return (
            <OptionRow key={size.id} id={id} label={size.name} price={formatBRL(price)}>
              <RadioGroupItem id={id} value={size.id} />
            </OptionRow>
          );
        })}
      </RadioGroup>
    </section>
  );
}

export function FlavorSection({ flavors, value, onChange }: { flavors: MenuProduct[]; value: string; onChange: (flavorId: string) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle id="item-flavor-title" title="Meio a meio" rule="Opcional" />
      <RadioGroup
        value={value || SINGLE_FLAVOR}
        onValueChange={(next) => onChange(next === SINGLE_FLAVOR ? "" : next)}
        aria-labelledby="item-flavor-title"
      >
        <OptionRow id="flavor-single" label="Só este sabor">
          <RadioGroupItem id="flavor-single" value={SINGLE_FLAVOR} />
        </OptionRow>
        {flavors.map((flavor) => (
          <OptionRow key={flavor.id} id={`flavor-${flavor.id}`} label={flavor.name}>
            <RadioGroupItem id={`flavor-${flavor.id}`} value={flavor.id} />
          </OptionRow>
        ))}
      </RadioGroup>
    </section>
  );
}

export function AddonGroupSection({
  group,
  selected,
  onToggle,
}: {
  group: MenuOptionGroup;
  selected: string[];
  onToggle: (optionId: string, checked: boolean) => void;
}) {
  const titleId = `group-${group.id}-title`;
  const rule = group.minSelect > 0 ? (group.maxSelect === 1 ? "Obrigatório" : `Obrigatório · até ${group.maxSelect}`) : `Até ${group.maxSelect}`;
  const selectedInGroup = group.options.filter((option) => selected.includes(option.id));
  const label = (option: MenuOptionGroup["options"][number]) => `${option.name}${option.available ? "" : " (esgotado)"}`;
  const price = (option: MenuOptionGroup["options"][number]) => (option.priceCents > 0 ? `+ ${formatBRL(option.priceCents)}` : undefined);

  if (group.maxSelect === 1) {
    return (
      <section className="flex flex-col gap-3">
        <SectionTitle id={titleId} title={group.name} rule={rule} />
        <RadioGroup
          value={selectedInGroup[0]?.id ?? NO_OPTION}
          onValueChange={(next) => onToggle(next === NO_OPTION ? "" : next, next !== NO_OPTION)}
          aria-labelledby={titleId}
        >
          {group.minSelect === 0 && (
            <OptionRow id={`${titleId}-none`} label="Nenhuma">
              <RadioGroupItem id={`${titleId}-none`} value={NO_OPTION} />
            </OptionRow>
          )}
          {group.options.map((option) => (
            <OptionRow key={option.id} id={`option-${option.id}`} label={label(option)} price={price(option)} disabled={!option.available}>
              <RadioGroupItem id={`option-${option.id}`} value={option.id} disabled={!option.available} />
            </OptionRow>
          ))}
        </RadioGroup>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={titleId}>
      <SectionTitle id={titleId} title={group.name} rule={rule} />
      {group.options.map((option) => {
        const checked = selected.includes(option.id);
        const disabled = !option.available || (!checked && selectedInGroup.length >= group.maxSelect);
        return (
          <OptionRow key={option.id} id={`option-${option.id}`} label={label(option)} price={price(option)} disabled={disabled}>
            <Checkbox
              id={`option-${option.id}`}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => onToggle(option.id, next === true)}
            />
          </OptionRow>
        );
      })}
    </section>
  );
}
