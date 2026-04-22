import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useNavigate }   from 'react-router-dom';
import { DriverLayout }  from '@/components/layout/DriverLayout';
import { Button }        from '@/components/ui/button';
import {
  MapPin, Navigation, Phone, Loader2, RefreshCw,
  Crosshair, Clock, ChevronRight, AlertCircle,
  Lock, Unlock, Route, ChevronDown, ChevronUp,
  CornerUpRight, MoveRight, ArrowUp, Flag,
} from 'lucide-react';
import { deliveryService, type DriverDelivery } from '@/api/services/delivery.service';
import { toast }  from 'sonner';
import { cn }     from '@/lib/utils';

// ─── Leaflet types ────────────────────────────────────────────────────────────

interface LMap {
  setView(c: [number, number], z: number, opts?: object): LMap;
  getZoom(): number;
  panTo(c: [number, number], opts?: object): LMap;
  fitBounds(b: unknown, opts?: object): LMap;
  remove(): void;
  on(ev: string, fn: () => void): void;
  off(ev: string, fn: () => void): void;
}
interface LMarker   { remove(): void; addTo(m: LMap): LMarker;   setIcon(i: unknown): LMarker; setLatLng(c: [number,number]): LMarker; bindPopup(s: string): LMarker; openPopup(): LMarker; }
interface LPolyline { remove(): void; addTo(m: LMap): LPolyline; getBounds(): unknown; }
interface LStatic {
  map(el: HTMLDivElement, opts?: object): LMap;
  tileLayer(url: string, opts?: object): { addTo(m: LMap): void };
  marker(c: [number, number], opts?: object): LMarker;
  polyline(pts: [number, number][], opts?: object): LPolyline;
  divIcon(opts: object): unknown;
  latLngBounds(corners: unknown[]): unknown;
}
declare const L: LStatic;

interface DeliveryWithCoords extends DriverDelivery {
  address?:             { latitude?: number; longitude?: number };
  delivery_latitude?:   number;
  delivery_longitude?:  number;
}

interface OsrmStep {
  maneuver: { type: string; modifier?: string; instruction?: string };
  name:     string;
  distance: number;
  duration: number;
}
interface OsrmLeg { steps: OsrmStep[]; distance: number; duration: number; }
interface OsrmRoute {
  geometry: { coordinates: [number, number][] };
  legs:     OsrmLeg[];
  distance: number;
  duration: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NAIROBI: [number, number] = [-1.2921, 36.8219];

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function fmtEta(s: number): string {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}
function toRad(d: number) { return (d * Math.PI) / 180; }
function bearing(from: [number, number], to: [number, number]): number {
  const dLng = toRad(to[1] - from[1]);
  const fLat = toRad(from[0]), tLat = toRad(to[0]);
  const x    = Math.cos(tLat) * Math.sin(dLng);
  const y    = Math.cos(fLat) * Math.sin(tLat) - Math.sin(fLat) * Math.cos(tLat) * Math.cos(dLng);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}
function haversine(a: [number, number], b: [number, number]): number {
  const R   = 6_371_000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h    = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchOsrmRoute(from: [number, number], to: [number, number]): Promise<OsrmRoute | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true&annotations=false`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = await res.json();
    return (data.routes?.[0] as OsrmRoute) ?? null;
  } catch {
    return null;
  }
}

const geocodeCache = new Map<string, [number, number]>();
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Kenya')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8_000) },
    );
    const data = await res.json();
    if (data[0]) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      geocodeCache.set(address, coords);
      return coords;
    }
  } catch { /* ignore */ }
  return null;
}

function driverIcon(deg: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;transform:rotate(${deg}deg);filter:drop-shadow(0 2px 8px rgba(0,0,0,.4))"><svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#16a34a" stroke="#fff" stroke-width="3"/><polygon points="20,7 28,31 20,25 12,31" fill="white" opacity="0.95"/></svg></div>`,
    iconSize:   [40, 40],
    iconAnchor: [20, 20],
  });
}

function destinationIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="filter:drop-shadow(0 3px 10px rgba(0,0,0,.45))"><svg viewBox="0 0 40 50" width="40" height="50"><path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30S40 35 40 20C40 9 31 0 20 0z" fill="#2563eb"/><circle cx="20" cy="20" r="9" fill="white"/><text x="20" y="24" text-anchor="middle" font-size="12" fill="#2563eb">📦</text></svg></div>`,
    iconSize:   [40, 50],
    iconAnchor: [20, 50],
  });
}

const ManeuverIcon: React.FC<{ type: string; modifier?: string }> = ({ type, modifier }) => {
  const cls = 'h-4 w-4 shrink-0 text-blue-600';
  if (type === 'arrive')             return <Flag           className={cls} />;
  if (type === 'depart')             return <ArrowUp        className={cls} />;
  if (modifier?.includes('right'))   return <CornerUpRight  className={cls} />;
  if (modifier?.includes('left'))    return <CornerUpRight  className={cn(cls, 'scale-x-[-1]')} />;
  return <MoveRight className={cls} />;
};

function stepText(step: OsrmStep): string {
  if (step.maneuver.instruction) return step.maneuver.instruction;
  const { type, modifier } = step.maneuver;
  const road = step.name ? ` onto ${step.name}` : '';
  if (type === 'depart')     return `Head ${modifier ?? 'forward'}${road}`;
  if (type === 'arrive')     return 'Arrive at destination';
  if (type === 'turn')       return `Turn ${modifier ?? ''}${road}`;
  if (type === 'roundabout') return `Enter roundabout${road}`;
  return `Continue${road}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const DriverMapPage: React.FC = () => {
  const navigate = useNavigate();

  const mapRef = useRef<HTMLDivElement>(null);
  const lmap      = useRef<LMap | null>(null);
  const driverMkr = useRef<LMarker | null>(null);
  const destMkr   = useRef<LMarker | null>(null);
  const routeLine = useRef<LPolyline | null>(null);
  const watchId   = useRef<number | null>(null);
  const prevPos   = useRef<[number, number] | null>(null);
  const lastRouteFrom = useRef<[number, number] | null>(null);

  const [deliveries,    setDeliveries]    = useState<DriverDelivery[]>([]);
  const [active,        setActive]        = useState<DriverDelivery | null>(null);
  const [destCoords,    setDestCoords]    = useState<[number, number] | null>(null);
  const [driverPos,     setDriverPos]     = useState<[number, number] | null>(null);
  const [driverBearing, setDriverBearing] = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [geocoding,     setGeocoding]     = useState(false);
  const [routing,       setRouting]       = useState(false);
  const [autoFollow,    setAutoFollow]    = useState(true);
  const [routeInfo,     setRouteInfo]     = useState<{ dist: number; eta: number } | null>(null);
  const [steps,         setSteps]         = useState<OsrmStep[]>([]);
  const [stepsOpen,     setStepsOpen]     = useState(false);
  const [noGps,         setNoGps]         = useState(false);
  const [mapReady,      setMapReady]      = useState(false);
  const [userDragged,   setUserDragged]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await deliveryService.getDriverDeliveries();
        const actives = (data.deliveries ?? []).filter(
          (d: DriverDelivery) => !['COMPLETED', 'FAILED'].includes(d.status),
        );
        setDeliveries(actives);
        if (actives.length) setActive(actives[0]);
      } catch {
        toast.error('Failed to load deliveries');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading || !mapRef.current || typeof L === 'undefined' || lmap.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView(NAIROBI, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    lmap.current = map;
    setMapReady(true);

    const onDrag = () => setUserDragged(true);
    map.on('dragstart', onDrag);

    return () => {
      map.off('dragstart', onDrag);
      map.remove();
      lmap.current = null;
    };
  }, [isLoading]);

  useEffect(() => {
    if (!mapReady) return;
    if (!navigator.geolocation) { setNoGps(true); return; }

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setDriverPos(prev => {
          if (prev) setDriverBearing(bearing(prev, coords));
          return coords;
        });
      },
      () => setNoGps(true),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15_000 },
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [mapReady]);

  useEffect(() => {
    if (!lmap.current || !driverPos) return;
    if (!driverMkr.current) {
      driverMkr.current = L.marker(driverPos, { icon: driverIcon(driverBearing), zIndexOffset: 1000 })
        .addTo(lmap.current).bindPopup('You are here');
    } else {
      driverMkr.current.setLatLng(driverPos).setIcon(driverIcon(driverBearing));
    }
    if (autoFollow && !userDragged) {
      lmap.current.panTo(driverPos, { animate: true, duration: 0.5 });
    }
  }, [driverPos, driverBearing, autoFollow, userDragged]);

  useEffect(() => {
    if (!active) { setDestCoords(null); setRouteInfo(null); setSteps([]); return; }
    const ext = active as DeliveryWithCoords;
    const lat  = ext.address?.latitude  ?? ext.delivery_latitude;
    const lng  = ext.address?.longitude ?? ext.delivery_longitude;
    if (lat != null && lng != null) { setDestCoords([lat, lng]); return; }
    if (active.full_address) {
      setGeocoding(true);
      geocodeAddress(active.full_address).then(coords => {
        if (coords) setDestCoords(coords);
        else toast.error('Could not geocode address');
        setGeocoding(false);
      });
    }
  }, [active]);

  const drawRoute = useCallback(async (from: [number, number], to: [number, number]) => {
    if (!lmap.current) return;
    setRouting(true);
    lastRouteFrom.current = from;

    destMkr.current?.remove();
    destMkr.current = L.marker(to, { icon: destinationIcon() })
      .addTo(lmap.current)
      .bindPopup(`<b>${active?.customer_name ?? ''}</b><br/>${active?.full_address ?? ''}`)
      .openPopup();

    const route = await fetchOsrmRoute(from, to);
    routeLine.current?.remove();
    routeLine.current = null;

    if (route) {
      const pts = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      routeLine.current = L.polyline(pts, {
        color: '#2563eb', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round',
      }).addTo(lmap.current);

      setRouteInfo({ dist: route.distance, eta: route.duration });
      setSteps(route.legs?.[0]?.steps ?? []);

      if (!prevPos.current) {
        lmap.current.fitBounds(
          (L as LStatic & { latLngBounds: (corners: unknown[]) => unknown }).latLngBounds([from, to]),
          { padding: [40, 40] },
        );
      }
    } else {
      toast.error('Could not calculate route — showing destination only');
      setRouteInfo(null);
      setSteps([]);
      lmap.current.setView(to, 15);
    }

    setRouting(false);
  }, [active]);

  useEffect(() => {
    if (!destCoords || !mapReady) return;
    drawRoute(driverPos ?? NAIROBI, destCoords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destCoords, mapReady]);

  useEffect(() => {
    if (!driverPos || !destCoords) return;
    const origin = lastRouteFrom.current;
    if (!origin) return;
    if (haversine(driverPos, origin) > 200) drawRoute(driverPos, destCoords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPos]);

  const handleRecalculate = () => {
    if (!driverPos)  { toast.error('Waiting for GPS…'); return; }
    if (!destCoords) { toast.error('No destination selected'); return; }
    drawRoute(driverPos, destCoords);
  };

  const handleLocateMe = () => {
    if (!driverPos) { toast.error('GPS not available'); return; }
    lmap.current?.setView(driverPos, 16);
    setAutoFollow(true);
    setUserDragged(false);
  };

  const handleSelectDelivery = (d: DriverDelivery) => {
    if (d.id === active?.id) return;
    setActive(d);
    setRouteInfo(null);
    setSteps([]);
    setStepsOpen(false);
  };

  const toggleAutoFollow = () => {
    setAutoFollow(f => {
      if (!f && driverPos) lmap.current?.setView(driverPos, 15);
      return !f;
    });
    setUserDragged(false);
  };

  const nextStep = useMemo(() => steps.find(s => s.maneuver.type !== 'depart'), [steps]);
  const isBusy   = geocoding || routing;

  if (isLoading) {
    return (
      <DriverLayout title="Navigation" subtitle="Loading…">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout title="Navigation" subtitle="Live driving route">

      {/* GPS warning */}
      {noGps && (
        <div className="flex items-center gap-2 mb-3 px-3 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          GPS unavailable — enable location permission for live tracking.
        </div>
      )}

      {/* Next-turn banner */}
      {nextStep && !isBusy && (
        <div className="flex items-center gap-3 mb-3 px-4 py-3.5 bg-blue-600 rounded-2xl text-white shadow-md shadow-blue-600/20">
          <div className="bg-white/20 rounded-xl p-2 shrink-0">
            <ManeuverIcon type={nextStep.maneuver.type} modifier={nextStep.maneuver.modifier} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{stepText(nextStep)}</p>
            <p className="text-xs text-blue-100 mt-0.5">{fmtDist(nextStep.distance)}</p>
          </div>
          {routeInfo && (
            <div className="text-right shrink-0">
              <p className="text-lg font-bold leading-none">{fmtEta(routeInfo.eta)}</p>
              <p className="text-[10px] text-blue-200">{fmtDist(routeInfo.dist)}</p>
            </div>
          )}
        </div>
      )}

      {/* Route info bar */}
      {!nextStep && (routeInfo || isBusy) && (
        <div className="flex items-center gap-3 mb-3 px-4 py-3.5 bg-blue-50 border border-blue-200 rounded-2xl">
          {isBusy
            ? <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
            : <Route   className="h-4 w-4 text-blue-600 shrink-0" />
          }
          {routeInfo && !isBusy ? (
            <div className="flex items-center gap-4 flex-1">
              <div>
                <p className="text-[10px] text-blue-500 font-semibold uppercase">Distance</p>
                <p className="text-sm font-bold text-blue-900">{fmtDist(routeInfo.dist)}</p>
              </div>
              <div className="h-6 w-px bg-blue-200" />
              <div>
                <p className="text-[10px] text-blue-500 font-semibold uppercase">ETA</p>
                <p className="text-sm font-bold text-blue-900">{fmtEta(routeInfo.eta)}</p>
              </div>
              {active && (
                <>
                  <div className="h-6 w-px bg-blue-200" />
                  <p className="text-xs font-semibold text-blue-900 truncate flex-1">{active.customer_name}</p>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-blue-700">
              {geocoding ? 'Geocoding address…' : 'Calculating route…'}
            </p>
          )}
        </div>
      )}

      {/* Map — takes most of the screen on mobile */}
      <div
        className="relative rounded-2xl overflow-hidden border border-border mb-3"
        style={{
          height: deliveries.length > 0
            ? 'calc(100svh - 28rem)'
            : 'calc(100svh - 14rem)',
          minHeight: 240,
        }}
      >
        <div ref={mapRef} className="w-full h-full" />

        {/* Map controls — compact, right side */}
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
          <Button
            size="sm"
            variant={autoFollow && !userDragged ? 'default' : 'secondary'}
            className="h-10 w-10 p-0 rounded-xl shadow"
            onClick={toggleAutoFollow}
          >
            {autoFollow && !userDragged ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
          <Button
            size="sm" variant="secondary"
            className="h-10 w-10 p-0 rounded-xl shadow"
            onClick={handleLocateMe}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
          <Button
            size="sm" variant="secondary"
            className="h-10 w-10 p-0 rounded-xl shadow"
            onClick={handleRecalculate}
            disabled={isBusy}
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {deliveries.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <MapPin className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-semibold text-sm">No active deliveries</p>
            <p className="text-xs text-muted-foreground mt-1">Accept a delivery to begin navigation</p>
          </div>
        )}
      </div>

      {/* Directions panel */}
      {steps.length > 0 && (
        <div className="rounded-2xl border overflow-hidden mb-3">
          <button
            className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold"
            onClick={() => setStepsOpen(o => !o)}
          >
            <span className="flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-600" />
              Directions ({steps.length} steps)
            </span>
            {stepsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {stepsOpen && (
            <div className="divide-y max-h-48 overflow-y-auto">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 text-xs">
                  <ManeuverIcon type={step.maneuver.type} modifier={step.maneuver.modifier} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug">{stepText(step)}</p>
                    {step.name && step.maneuver.type !== 'arrive' && (
                      <p className="text-muted-foreground mt-0.5">{step.name}</p>
                    )}
                  </div>
                  <p className="text-muted-foreground shrink-0">{fmtDist(step.distance)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delivery cards — horizontal scroll */}
      {deliveries.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Active Stops ({deliveries.length})
          </p>

          <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x -mx-4 px-4">
            {deliveries.map(d => {
              const isSelected = active?.id === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => handleSelectDelivery(d)}
                  className={cn(
                    'shrink-0 w-[260px] snap-start rounded-2xl border overflow-hidden cursor-pointer transition-all',
                    isSelected
                      ? 'border-primary/40 shadow-md shadow-primary/10'
                      : 'border-border/70 bg-card',
                  )}
                >
                  <div className={cn('h-[3px] w-full', isSelected ? 'bg-primary' : 'bg-border')} />

                  <div className="p-3 space-y-2.5 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{d.customer_name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{d.order_number}</p>
                      </div>
                      {isSelected && (
                        <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-xl px-2.5 py-2">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2 leading-relaxed">{d.full_address}</span>
                    </div>

                    {isSelected && routeInfo && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-blue-600 font-bold">
                          <Route className="h-3 w-3" />{fmtDist(routeInfo.dist)}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600 font-bold">
                          <Clock className="h-3 w-3" />{fmtEta(routeInfo.eta)}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        size="sm" variant="outline"
                        className="h-10 text-xs rounded-xl"
                        onClick={e => { e.stopPropagation(); window.open(`tel:${d.customer_phone}`); }}
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-10 text-xs rounded-xl"
                        onClick={e => {
                          e.stopPropagation();
                          window.open(`https://maps.google.com/?saddr=Current+Location&daddr=${encodeURIComponent(d.full_address)}&travelmode=driving`);
                        }}
                      >
                        <Navigation className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm" variant="ocean"
                        className="h-10 text-xs rounded-xl"
                        onClick={e => { e.stopPropagation(); navigate(`/driver/deliveries/${d.id}`); }}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </DriverLayout>
  );
};

export default DriverMapPage;