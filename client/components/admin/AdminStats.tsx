import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { dsClasses } from "@/lib/design-system";

interface SystemStats {
  totalUsers: number;
  adminUsers: number;
  bannedUsers: number;
  activeLicenses: number;
  totalMessages: number;
  avgMessagesPerUser: number;
  totalLicenses: number;
  usedLicenses: number;
  activityLogsCount: number;
  freeUsers: number;
  proUsers: number;
  activityByDay: Record<string, number>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  lastUpdated?: string;
}

function StatCard({ title, value, change, trend, lastUpdated }: StatCardProps) {
  return (
    <div
      className={`${dsClasses.card} p-6 flex flex-col gap-3 group hover:border-white/10 transition-all duration-200`}
    >
      <div className="flex items-center justify-between">
        <p className="text-white/70 text-13px font-medium uppercase tracking-wide">
          {title}
        </p>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-white">{value}</span>
        {change && (
          <div
            className={`text-12px font-medium px-2 py-1 rounded-md ${
              trend === "up"
                ? "bg-emerald-500/15 text-emerald-400"
                : trend === "down"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-gray-500/15 text-gray-400"
            }`}
          >
            {change}
          </div>
        )}
      </div>

      {lastUpdated && (
        <p className="text-11px text-white/40 mt-auto">{lastUpdated}</p>
      )}
    </div>
  );
}

export default function AdminStats() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Non authentifié");

        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/admin/system-stats", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!response.ok) throw new Error("Erreur lors du chargement");

        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh toutes les minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-white/60" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-white/60 text-14px">
        Impossible de charger les statistiques
      </div>
    );
  }

  const storagePercent = Math.round(
    (stats.storage.used / stats.storage.total) * 100,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Tableau de bord</h2>
        <p className="text-white/60 text-14px">
          Aperçu en temps réel de l'activité du système
        </p>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Utilisateurs totaux"
          value={stats.totalUsers}
          lastUpdated="Mise à jour en temps réel"
        />
        <StatCard
          title="Administrateurs"
          value={stats.adminUsers}
          lastUpdated="Mise à jour en temps réel"
        />
        <StatCard
          title="Licences actives"
          value={stats.activeLicenses}
          lastUpdated="Mise à jour en temps réel"
        />
        <StatCard
          title="Utilisateurs bannis"
          value={stats.bannedUsers}
          lastUpdated="Mise à jour en temps réel"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${dsClasses.card} p-4 space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-12px font-medium uppercase">
              Messages utilisateurs
            </span>
            <span className="text-emerald-400 text-12px font-semibold">
              {stats.totalMessages}
            </span>
          </div>
          <p className="text-12px text-white/70">
            Moyenne: {stats.avgMessagesPerUser} par utilisateur
          </p>
          <p className="text-11px text-white/40">Total envoyés</p>
        </div>

        <div className={`${dsClasses.card} p-4 space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-12px font-medium uppercase">
              Distribution des licences
            </span>
            <span className="text-emerald-400 text-12px font-semibold">
              {Math.round((stats.usedLicenses / stats.totalLicenses) * 100)}%
            </span>
          </div>
          <p className="text-12px text-white/70">
            Utilisées: {stats.usedLicenses} / {stats.totalLicenses}
          </p>
          <p className="text-11px text-white/40">Taux d'utilisation</p>
        </div>

        <div className={`${dsClasses.card} p-4 space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-12px font-medium uppercase">
              Distribution des plans
            </span>
            <span className="text-emerald-400 text-12px font-semibold">
              {stats.freeUsers + stats.proUsers}
            </span>
          </div>
          <p className="text-12px text-white/70">
            Gratuit: {stats.freeUsers} • Premium: {stats.proUsers}
          </p>
          <p className="text-11px text-white/40">Utilisateurs actifs</p>
        </div>
      </div>
    </div>
  );
}
