import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getOrganizations, getPlots, getRole } from '@/services/data';
import type { Organization, Plot, Role } from '@/types/domain';

type AgroState = {
  orgs: Organization[];
  org: Organization | null;
  setOrg: (organization: Organization) => void;
  plots: Plot[];
  role: Role | null;
  loading: boolean;
  error: string | null;
};

const Context = createContext<AgroState | null>(null);

export function AgroProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function syncUser(nextUserId: string | null) {
      if (!mounted) return;
      setUserId(nextUserId);
      setLoading(true);
      setError(null);
      setRole(null);
      setPlots([]);

      if (!nextUserId) {
        setOrgs([]);
        setOrg(null);
        setLoading(false);
        return;
      }

      try {
        const organizations = await getOrganizations();
        if (!mounted) return;
        setOrgs(organizations);
        setOrg(organizations[0] ?? null);
      } catch (caught) {
        if (!mounted) return;
        setOrgs([]);
        setOrg(null);
        setError(caught instanceof Error && 'status' in caught && caught.status === 403 ? 'No tenés permisos para consultar este establecimiento.' : caught instanceof Error ? caught.message : 'Error de red');
        setLoading(false);
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      void syncUser(data.session?.user.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId || !org) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    setRole(null);
    setPlots([]);

    void Promise.all([getRole(userId, org.id), getPlots(org.id)])
      .then(([nextRole, nextPlots]) => {
        if (!mounted) return;
        setRole(nextRole);
        setPlots(nextPlots);
        setError(null);
      })
      .catch(caught => {
        if (!mounted) return;
        setRole(null);
        setPlots([]);
        setError(caught instanceof Error && 'status' in caught && caught.status === 403 ? 'No tenés permisos para consultar este establecimiento.' : caught instanceof Error ? caught.message : 'Error de red');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId, org]);

  return <Context.Provider value={{ orgs, org, setOrg, plots, role, loading, error }}>{children}</Context.Provider>;
}

export function useAgroContext() {
  const value = useContext(Context);
  if (!value) throw new Error('useAgroContext must be used inside AgroProvider');
  return value;
}
