import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { RADE_CENTER, fmtDate } from "@/lib/format";

const pin = (color, active) =>
  L.divIcon({
    className: "",
    html: `<span class="rade-pin${active ? " rade-pin--active" : ""}" style="--pin:${color}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

const Tiles = () => (
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
);

export const CollecteMap = ({ collectes, activeId, className = "" }) => (
  <div data-testid="collectes-map" className="h-full w-full">
  <MapContainer center={RADE_CENTER} zoom={12} scrollWheelZoom className={`h-full w-full ${className}`}>
    <Tiles />
    {collectes.map((c) => (
      <Marker key={c.id} position={[c.lat, c.lng]} icon={pin(c.complet ? "#EF4444" : "#0D9488", c.id === activeId)}>
        <Popup>
          <div className="space-y-1">
            <p className="font-semibold">{c.titre}</p>
            <p className="text-xs capitalize">{fmtDate(c.date)}</p>
            <Link to={`/collectes/${c.id}`} className="text-xs font-semibold text-[#0D9488]" data-testid={`map-popup-link-${c.id}`}>Voir la fiche →</Link>
          </div>
        </Popup>
      </Marker>
    ))}
  </MapContainer>
  </div>
);

const ClickCatcher = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
};

export const LocationPicker = ({ value, onPick }) => (
  <div data-testid="publish-map-picker">
    <MapContainer center={value || RADE_CENTER} zoom={12} className="h-72 w-full rounded-2xl border border-slate-200">
      <Tiles />
      <ClickCatcher onPick={onPick} />
      {value && <Marker position={value} icon={pin("#E05638", true)} />}
    </MapContainer>
  </div>
);

export const SingleMap = ({ c }) => (
  <div data-testid="collecte-detail-map">
    <MapContainer center={[c.lat, c.lng]} zoom={14} className="h-64 w-full rounded-2xl border border-slate-200">
      <Tiles />
      <Marker position={[c.lat, c.lng]} icon={pin("#0D9488", true)} />
    </MapContainer>
  </div>
);
