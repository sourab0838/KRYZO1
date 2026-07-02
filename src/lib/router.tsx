import { useEffect, useState, useCallback } from 'react';

export interface RouteState {
  path: string;
  query: URLSearchParams;
}

function parseHash(): RouteState {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path, queryString] = hash.split('?');
  return {
    path: path || '/',
    query: new URLSearchParams(queryString || ''),
  };
}

export function navigate(to: string) {
  if (window.location.hash === `#${to}`) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.location.hash = to;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(parseHash());

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((to: string) => navigate(to), []);
  return { route, go };
}

export function Link({
  to,
  className,
  children,
  onClick,
  style,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <a
      href={`#${to}`}
      className={className}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
