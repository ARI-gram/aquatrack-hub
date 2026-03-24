/**
 * Cascading Location Selector
 * src/components/common/CascadingLocationSelector.tsx
 *
 * Country → City (dropdown) → Area/Sub-county (dropdown) → Street (text) → Postal code (auto-filled)
 * Falls back to free-text for countries without cascade data.
 */

import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCities, getAreas, getPostalCode, hasCascade } from '@/data/locationData';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocationValue {
  city: string;
  state: string;    // area / sub-county / province
  address: string;  // street address (free text)
  zipCode: string;  // auto-filled
}

interface FieldErrors {
  city?: { message?: string };
  state?: { message?: string };
  address?: { message?: string };
  zipCode?: { message?: string };
}

interface CascadingLocationSelectorProps {
  country: string;
  value: LocationValue;
  onChange: (next: Partial<LocationValue>) => void;
  errors?: FieldErrors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CascadingLocationSelector: React.FC<CascadingLocationSelectorProps> = ({
  country,
  value,
  onChange,
  errors = {},
}) => {
  const cascade = hasCascade(country);
  const cities  = getCities(country);
  const areas   = getAreas(country, value.city);

  // When country changes → reset dependent fields
  useEffect(() => {
    onChange({ city: '', state: '', zipCode: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  // When city changes → reset area + postal code
  const handleCityChange = (city: string) => {
    onChange({ city, state: '', zipCode: '' });
  };

  // When area changes → auto-fill postal code
  const handleAreaChange = (area: string) => {
    const postal = getPostalCode(country, value.city, area);
    onChange({ state: area, zipCode: postal });
  };

  // ── Cascade mode (Kenya + EA countries) ─────────────────────────────────
  if (cascade) {
    return (
      <div className="space-y-4">
        {/* City */}
        <div className="space-y-2">
          <Label>
            City <span className="text-destructive">*</span>
          </Label>
          <Select
            value={value.city}
            onValueChange={handleCityChange}
            disabled={!country}
          >
            <SelectTrigger className={errors.city ? 'border-destructive' : ''}>
              <SelectValue placeholder={country ? 'Select city' : 'Select country first'} />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
        </div>

        {/* Area / Sub-county */}
        <div className="space-y-2">
          <Label>
            Area / Sub-county <span className="text-destructive">*</span>
          </Label>
          <Select
            value={value.state}
            onValueChange={handleAreaChange}
            disabled={!value.city}
          >
            <SelectTrigger className={errors.state ? 'border-destructive' : ''}>
              <SelectValue placeholder={value.city ? 'Select area' : 'Select city first'} />
            </SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
        </div>

        {/* Street address */}
        <div className="space-y-2">
          <Label htmlFor="address">
            Street Address <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="address"
            placeholder={
              value.state
                ? `e.g., 14 Mombasa Road, ${value.state}`
                : 'Select area first, then enter street address'
            }
            rows={2}
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
            disabled={!value.state}
            className={errors.address ? 'border-destructive' : ''}
          />
          {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
        </div>

        {/* Postal code — auto-filled, read-only but visible */}
        <div className="space-y-2">
          <Label htmlFor="zipCode">Postal Code</Label>
          <div className="relative">
            <Input
              id="zipCode"
              value={value.zipCode}
              readOnly
              placeholder="Auto-filled when area is selected"
              className="bg-muted/40 cursor-not-allowed text-muted-foreground"
            />
            {value.zipCode && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-success font-medium">
                ✓ Auto-filled
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Free-text fallback (other countries) ──────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* City */}
        <div className="space-y-2">
          <Label htmlFor="city">
            City <span className="text-destructive">*</span>
          </Label>
          <Input
            id="city"
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="e.g., Lagos"
            className={errors.city ? 'border-destructive' : ''}
          />
          {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
        </div>

        {/* State / Province */}
        <div className="space-y-2">
          <Label htmlFor="state">
            State / Province <span className="text-destructive">*</span>
          </Label>
          <Input
            id="state"
            value={value.state}
            onChange={(e) => onChange({ state: e.target.value })}
            placeholder="e.g., Lagos State"
            className={errors.state ? 'border-destructive' : ''}
          />
          {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
        </div>

        {/* Postal code */}
        <div className="space-y-2">
          <Label htmlFor="zipCode">
            Postal Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="zipCode"
            value={value.zipCode}
            onChange={(e) => onChange({ zipCode: e.target.value })}
            placeholder="e.g., 100001"
            className={errors.zipCode ? 'border-destructive' : ''}
          />
          {errors.zipCode && <p className="text-xs text-destructive">{errors.zipCode.message}</p>}
        </div>
      </div>

      {/* Street address */}
      <div className="space-y-2">
        <Label htmlFor="address">
          Street Address <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="address"
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Enter street address"
          rows={2}
          className={errors.address ? 'border-destructive' : ''}
        />
        {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
      </div>
    </div>
  );
};