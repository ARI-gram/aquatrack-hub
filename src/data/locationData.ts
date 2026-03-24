/**
 * Location Data
 * src/data/locationData.ts
 *
 * Structure: Country → Cities → Areas/Sub-counties → Postal code
 * Focus: Kenya (primary market) with full data, other countries with major cities.
 */

export interface AreaData {
  postalCode: string;
}

export interface CityData {
  areas: Record<string, AreaData>;
}

export interface CountryData {
  cities: Record<string, CityData>;
  /** If false, show free-text fields instead of selects */
  hasCascade: boolean;
}

export const LOCATION_DATA: Record<string, CountryData> = {
  Kenya: {
    hasCascade: true,
    cities: {
      Nairobi: {
        areas: {
          'CBD / City Centre':         { postalCode: '00100' },
          'Westlands':                 { postalCode: '00100' },
          'Karen':                     { postalCode: '00502' },
          'Langata':                   { postalCode: '00509' },
          'Kilimani':                  { postalCode: '00100' },
          'Lavington':                 { postalCode: '00100' },
          'Gigiri':                    { postalCode: '00621' },
          'Runda':                     { postalCode: '00621' },
          'Muthaiga':                  { postalCode: '00623' },
          'Parklands':                 { postalCode: '00620' },
          'Eastleigh':                 { postalCode: '00610' },
          'South B':                   { postalCode: '00200' },
          'South C':                   { postalCode: '00200' },
          'Buruburu':                  { postalCode: '00300' },
          'Donholm':                   { postalCode: '00300' },
          'Embakasi':                  { postalCode: '00517' },
          'Kasarani':                  { postalCode: '00630' },
          'Ruaka':                     { postalCode: '00232' },
          'Kikuyu':                    { postalCode: '00902' },
          'Industrial Area':           { postalCode: '00610' },
          'Upper Hill':                { postalCode: '00100' },
          'Hurlingham':                { postalCode: '00100' },
          'Ngong Road':                { postalCode: '00100' },
          'Kileleshwa':                { postalCode: '00100' },
        },
      },
      Mombasa: {
        areas: {
          'Mombasa Island / CBD':      { postalCode: '80100' },
          'Nyali':                     { postalCode: '80118' },
          'Bamburi':                   { postalCode: '80100' },
          'Likoni':                    { postalCode: '80100' },
          'Changamwe':                 { postalCode: '80101' },
          'Kisauni':                   { postalCode: '80117' },
          'Tudor':                     { postalCode: '80100' },
          'Kizingo':                   { postalCode: '80100' },
          'Ganjoni':                   { postalCode: '80100' },
          'Diani Beach':               { postalCode: '80400' },
          'Shanzu':                    { postalCode: '80100' },
        },
      },
      Kisumu: {
        areas: {
          'Kisumu CBD':                { postalCode: '40100' },
          'Milimani':                  { postalCode: '40100' },
          'Kondele':                   { postalCode: '40100' },
          'Nyalenda':                  { postalCode: '40100' },
          'Mamboleo':                  { postalCode: '40100' },
          'Riat':                      { postalCode: '40100' },
          'Lolwe':                     { postalCode: '40100' },
        },
      },
      Nakuru: {
        areas: {
          'Nakuru Town CBD':           { postalCode: '20100' },
          'Milimani':                  { postalCode: '20100' },
          'Section 58':                { postalCode: '20100' },
          'Flamingo':                  { postalCode: '20100' },
          'Lanet':                     { postalCode: '20118' },
          'Kabarak':                   { postalCode: '20157' },
          'Naivasha':                  { postalCode: '20117' },
        },
      },
      Eldoret: {
        areas: {
          'Eldoret Town CBD':          { postalCode: '30100' },
          'Pioneer':                   { postalCode: '30100' },
          'Elgon View':                { postalCode: '30100' },
          'West Indies':               { postalCode: '30100' },
          'Huruma':                    { postalCode: '30100' },
          'Kapsabet':                  { postalCode: '30300' },
        },
      },
      Thika: {
        areas: {
          'Thika Town CBD':            { postalCode: '01000' },
          'Makongeni':                 { postalCode: '01000' },
          'Landless':                  { postalCode: '01000' },
          'Gatuanyaga':                { postalCode: '01000' },
          'Stadium':                   { postalCode: '01000' },
        },
      },
      Nyeri: {
        areas: {
          'Nyeri Town CBD':            { postalCode: '10100' },
          'Karatina':                  { postalCode: '10101' },
          'Othaya':                    { postalCode: '10102' },
          'Mukurwe-ini':               { postalCode: '10200' },
        },
      },
      Meru: {
        areas: {
          'Meru Town CBD':             { postalCode: '60200' },
          'Nkubu':                     { postalCode: '60204' },
          'Chuka':                     { postalCode: '60400' },
          'Timau':                     { postalCode: '60206' },
        },
      },
      Malindi: {
        areas: {
          'Malindi Town':              { postalCode: '80200' },
          'Watamu':                    { postalCode: '80202' },
          'Mambrui':                   { postalCode: '80200' },
        },
      },
      Garissa: {
        areas: {
          'Garissa Town':              { postalCode: '70100' },
          'Bula Iftin':                { postalCode: '70100' },
        },
      },
      Kisii: {
        areas: {
          'Kisii Town CBD':            { postalCode: '40200' },
          'Ogembo':                    { postalCode: '40200' },
          'Keroka':                    { postalCode: '40203' },
        },
      },
      Machakos: {
        areas: {
          'Machakos Town':             { postalCode: '90100' },
          'Athi River / Mavoko':       { postalCode: '00204' },
          'Kathiani':                  { postalCode: '90116' },
        },
      },
    },
  },

  Uganda: {
    hasCascade: true,
    cities: {
      Kampala: {
        areas: {
          'Kampala CBD':               { postalCode: '256' },
          'Kololo':                    { postalCode: '256' },
          'Nakasero':                  { postalCode: '256' },
          'Bugolobi':                  { postalCode: '256' },
          'Ntinda':                    { postalCode: '256' },
          'Muyenga':                   { postalCode: '256' },
          'Entebbe':                   { postalCode: '256' },
          'Jinja Road':                { postalCode: '256' },
        },
      },
      Entebbe: {
        areas: {
          'Entebbe Town':              { postalCode: '256' },
          'Katabi':                    { postalCode: '256' },
        },
      },
      Jinja: {
        areas: {
          'Jinja Town':                { postalCode: '256' },
          'Walukuba':                  { postalCode: '256' },
        },
      },
      Gulu: {
        areas: {
          'Gulu Town':                 { postalCode: '256' },
          'Bar Dege':                  { postalCode: '256' },
        },
      },
    },
  },

  Tanzania: {
    hasCascade: true,
    cities: {
      'Dar es Salaam': {
        areas: {
          'Kariakoo / CBD':            { postalCode: '11101' },
          'Msasani':                   { postalCode: '14111' },
          'Oyster Bay':                { postalCode: '14111' },
          'Upanga':                    { postalCode: '11101' },
          'Kinondoni':                 { postalCode: '14101' },
          'Ilala':                     { postalCode: '11101' },
          'Temeke':                    { postalCode: '12101' },
        },
      },
      Arusha: {
        areas: {
          'Arusha Town CBD':           { postalCode: '23101' },
          'Njiro':                     { postalCode: '23101' },
          'Sakina':                    { postalCode: '23101' },
        },
      },
      Zanzibar: {
        areas: {
          'Stone Town':                { postalCode: '71101' },
          'Ng\'ambo':                  { postalCode: '71101' },
        },
      },
      Mwanza: {
        areas: {
          'Mwanza CBD':                { postalCode: '33101' },
          'Ilemela':                   { postalCode: '33101' },
        },
      },
    },
  },

  Rwanda: {
    hasCascade: true,
    cities: {
      Kigali: {
        areas: {
          'Kigali CBD / Nyarugenge':   { postalCode: '250' },
          'Kicukiro':                  { postalCode: '250' },
          'Gasabo':                    { postalCode: '250' },
          'Kimironko':                 { postalCode: '250' },
          'Remera':                    { postalCode: '250' },
          'Gikondo':                   { postalCode: '250' },
        },
      },
      Musanze: {
        areas: {
          'Musanze Town':              { postalCode: '250' },
          'Kinigi':                    { postalCode: '250' },
        },
      },
    },
  },

  Ethiopia: {
    hasCascade: true,
    cities: {
      'Addis Ababa': {
        areas: {
          'Bole':                      { postalCode: '1000' },
          'Kirkos':                    { postalCode: '1000' },
          'Kolfe Keranio':             { postalCode: '1000' },
          'Lideta':                    { postalCode: '1000' },
          'Yeka':                      { postalCode: '1000' },
          'Arada (Piazza)':            { postalCode: '1000' },
        },
      },
      'Dire Dawa': {
        areas: {
          'Dire Dawa City':            { postalCode: '1000' },
        },
      },
    },
  },

  // Non-cascade countries — show free text fields
  Nigeria:          { hasCascade: false, cities: {} },
  'South Africa':   { hasCascade: false, cities: {} },
  Ghana:            { hasCascade: false, cities: {} },
  Egypt:            { hasCascade: false, cities: {} },
  Morocco:          { hasCascade: false, cities: {} },
  'United States':  { hasCascade: false, cities: {} },
  'United Kingdom': { hasCascade: false, cities: {} },
  India:            { hasCascade: false, cities: {} },
  Other:            { hasCascade: false, cities: {} },
};

/** Get sorted city names for a country */
export function getCities(country: string): string[] {
  return Object.keys(LOCATION_DATA[country]?.cities ?? {}).sort();
}

/** Get sorted area names for a country + city */
export function getAreas(country: string, city: string): string[] {
  return Object.keys(LOCATION_DATA[country]?.cities[city]?.areas ?? {}).sort();
}

/** Get postal code for a country + city + area */
export function getPostalCode(country: string, city: string, area: string): string {
  return LOCATION_DATA[country]?.cities[city]?.areas[area]?.postalCode ?? '';
}

/** Whether this country uses cascading selects */
export function hasCascade(country: string): boolean {
  return LOCATION_DATA[country]?.hasCascade ?? false;
}