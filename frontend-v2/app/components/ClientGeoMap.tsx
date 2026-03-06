import React, { useEffect, useState } from 'react';

const ClientGeoMap = ({ ip }: { ip?: string }) => {
  const [geo, setGeo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ip) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`https://ipapi.co/${ip}/json/`)
      .then((res) => {
        if (!res.ok) throw new Error('lookup-failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data && data.latitude && data.longitude) {
          setGeo(data);
        } else {
          setError('No location data');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError('Lookup failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ip]);

  if (!ip) return <div className="text-xs text-muted-foreground">No IP</div>;
  if (loading) return <div className="text-xs">Looking up {ip}…</div>;
  if (error) return <div className="text-xs text-red-500">{error}</div>;
  if (!geo) return null;

  const lat = parseFloat(String(geo.latitude));
  const lon = parseFloat(String(geo.longitude));
  const delta = 0.05;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;

  return (
    <div className="mt-2">
      <div className="text-xs text-muted-foreground">
        {geo.city ? `${geo.city}, ` : ''}
        {geo.region ? `${geo.region}, ` : ''}
        {geo.country_name || geo.country}
      </div>
      <div className="mt-1 rounded overflow-hidden border" style={{ height: 180 }}>
        <iframe
          title={`map-${ip}`}
          src={src}
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </div>
    </div>
  );
};

export default ClientGeoMap;
