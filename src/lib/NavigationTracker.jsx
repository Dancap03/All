import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Componente que simplemente notifica al padre (si existe) cuando cambia la URL.
// Eliminada la dependencia de base44.appLogs que ya no existe.
export default function NavigationTracker() {
    const location = useLocation();

    useEffect(() => {
        window.parent?.postMessage({
            type: 'app_changed_url',
            url: window.location.href
        }, '*');
    }, [location]);

    return null;
}
