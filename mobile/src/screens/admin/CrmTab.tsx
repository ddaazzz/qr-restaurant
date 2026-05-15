/**
 * CrmTab.tsx — Standalone CRM + Loyalty tab for iPad / admin dashboard.
 *
 * Shows all customers (crm_customers joined with xish_members via
 * GET /api/restaurants/:id/xish/members).
 *
 * Features:
 *  - Customer list with search + sort
 *  - Member profile: name, phone, email, tier, points_balance
 *  - Edit name / phone / email via PATCH /api/xish/members/:memberId
 *  - Award points via POST /api/xish/members/:memberId/award-points
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface XishMember {
  crm_customer_id: number;
  xish_member_id: number | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  total_visits?: number;
  total_spent_cents?: number;
  last_visit_at?: string | null;
  registered_at?: string;
  xish_member_status?: string | null;
  points_balance?: number | null;
  tier?: string | null;
  xish_id?: string | null;
  active_coupons?: number;
  card_balance_cents?: number;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const formatCurrency = (cents?: number | null) =>
  `$${((cents || 0) / 100).toFixed(2)}`;

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  basic:    { bg: '#f3f4f6', text: '#6b7280' },
  silver:   { bg: '#e5e7eb', text: '#374151' },
  gold:     { bg: '#fef3c7', text: '#b45309' },
  platinum: { bg: '#ede9fe', text: '#7c3aed' },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface CrmTabProps {
  restaurantId: string | number;
}

export const CrmTab = ({ restaurantId }: CrmTabProps) => {
  const PAGE_SIZE = 40;

  // List state
  const [members, setMembers] = useState<XishMember[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy] = useState<'last_visit' | 'total_spent' | 'created_at'>('last_visit');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected member
  const [selected, setSelected] = useState<XishMember | null>(null);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Award points modal state
  const [showAward, setShowAward] = useState(false);
  const [awardPoints, setAwardPoints] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [awardSaving, setAwardSaving] = useState(false);

  // ── Fetch members ──────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async ({
    pageNum = 1,
    search = searchTerm,
    append = false,
  }: { pageNum?: number; search?: string; append?: boolean } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);

      const res = await apiClient.get(`/api/restaurants/${restaurantId}/xish/members?${params}`);
      const { members: rows, total: tot } = res.data as { members: XishMember[]; total: number };

      if (append) {
        setMembers(prev => [...prev, ...rows]);
      } else {
        setMembers(rows);
      }
      setTotal(tot);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load members');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [restaurantId, searchTerm]);

  useEffect(() => {
    fetchMembers({ pageNum: 1, search: '' });
  }, [restaurantId]);

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchTerm(text);
      fetchMembers({ pageNum: 1, search: text });
    }, 400);
  };

  // ── Save edit ──────────────────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!selected) return;
    if (!editName.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setEditSaving(true);
    try {
      // Update crm_customers (name + phone + email)
      await apiClient.patch(
        `/api/restaurants/${restaurantId}/crm/customers/${selected.crm_customer_id}`,
        { name: editName.trim(), phone: editPhone || null, email: editEmail || null }
      );
      // Also sync name/phone to xish_members side if member exists
      if (selected.xish_member_id) {
        await apiClient.patch(`/api/xish/members/${selected.xish_member_id}`, {
          name: editName.trim(),
          phone: editPhone || null,
        }).catch(() => {}); // non-fatal
      }
      const updated = { ...selected, name: editName.trim(), phone: editPhone || null, email: editEmail || null };
      setSelected(updated);
      setMembers(prev => prev.map(m => m.crm_customer_id === selected.crm_customer_id ? { ...m, name: editName.trim(), phone: editPhone || null, email: editEmail || null } : m));
      setShowEdit(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Award points ───────────────────────────────────────────────────────────

  const handleAwardPoints = async () => {
    if (!selected?.xish_member_id) return;
    const delta = parseInt(awardPoints);
    if (isNaN(delta) || delta === 0) {
      Alert.alert('Invalid', 'Enter a non-zero points amount');
      return;
    }
    setAwardSaving(true);
    try {
      const res = await apiClient.post(`/api/xish/members/${selected.xish_member_id}/award-points`, {
        points_delta: delta,
        restaurant_id: Number(restaurantId),
        reason: awardReason || 'manual',
      });
      const { points_balance, tier } = res.data;
      const updated = { ...selected, points_balance, tier };
      setSelected(updated);
      setMembers(prev => prev.map(m => m.xish_member_id === selected.xish_member_id ? { ...m, points_balance, tier } : m));
      setAwardPoints('');
      setAwardReason('');
      setShowAward(false);
      Alert.alert('Points Awarded', `New balance: ${points_balance} pts (${tier})`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to award points');
    } finally {
      setAwardSaving(false);
    }
  };

  // ── Render member card ─────────────────────────────────────────────────────

  const renderMemberCard = (member: XishMember) => {
    const initials = (member.name || '?').slice(0, 2).toUpperCase();
    const tier = member.tier || 'basic';
    const tierColors = TIER_COLORS[tier] || TIER_COLORS.basic;
    return (
      <TouchableOpacity
        key={member.crm_customer_id}
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => setSelected(member)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.cardName}>{member.name || '—'}</Text>
            {member.xish_member_id && (
              <View style={[styles.tierBadge, { backgroundColor: tierColors.bg }]}>
                <Text style={[styles.tierBadgeText, { color: tierColors.text }]}>{tier}</Text>
              </View>
            )}
          </View>
          {member.phone && <Text style={styles.cardMeta}>📞 {member.phone}</Text>}
          {member.email && <Text style={styles.cardMeta}>✉️ {member.email}</Text>}
          <Text style={styles.cardMeta}>
            {member.total_visits || 0} visits · Last {formatDate(member.last_visit_at)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {member.xish_member_id ? (
            <Text style={styles.cardPoints}>{member.points_balance ?? 0} pts</Text>
          ) : null}
          <Text style={styles.cardSpend}>{formatCurrency(member.total_spent_cents)}</Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render profile ─────────────────────────────────────────────────────────

  const renderProfile = () => {
    if (!selected) return null;
    const initials = (selected.name || '?').slice(0, 2).toUpperCase();
    const tier = selected.tier || 'basic';
    const tierColors = TIER_COLORS[tier] || TIER_COLORS.basic;

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelected(null)}>
          <Ionicons name="arrow-back" size={16} color="#4f46e5" />
          <Text style={styles.backBtnText}> Back to members</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.heroName}>{selected.name || '—'}</Text>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setEditName(selected.name || '');
                  setEditPhone(selected.phone || '');
                  setEditEmail(selected.email || '');
                  setShowEdit(true);
                }}
              >
                <Ionicons name="pencil" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            {selected.phone && (
              <Text style={styles.heroContact}>📞 {selected.phone}</Text>
            )}
            {selected.email && (
              <Text style={styles.heroContact}>✉️ {selected.email}</Text>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{selected.total_visits || 0}</Text>
            <Text style={styles.statLabel}>Visits</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(selected.total_spent_cents)}</Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
          {selected.xish_member_id ? (
            <>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{selected.points_balance ?? 0}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: tierColors.bg }]}>
                <Text style={[styles.statValue, { color: tierColors.text }]}>{tier}</Text>
                <Text style={styles.statLabel}>Tier</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Award points */}
        {selected.xish_member_id ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loyalty Points</Text>
            <Text style={styles.sectionSub}>Balance: {selected.points_balance ?? 0} pts · Tier: {tier}</Text>
            <TouchableOpacity
              style={styles.awardBtn}
              onPress={() => { setAwardPoints(''); setAwardReason(''); setShowAward(true); }}
            >
              <Ionicons name="star" size={14} color="#fff" />
              <Text style={styles.awardBtnText}>Award Points</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loyalty</Text>
            <Text style={styles.sectionSub}>Not a loyalty member yet.</Text>
          </View>
        )}

        {/* Contact */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Contact Info</Text>
            <TouchableOpacity
              onPress={() => {
                setEditName(selected.name || '');
                setEditPhone(selected.phone || '');
                setEditEmail(selected.email || '');
                setShowEdit(true);
              }}
            >
              <Text style={{ color: '#4f46e5', fontSize: 13 }}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Name</Text><Text style={styles.infoValue}>{selected.name || '—'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue}>{selected.phone || '—'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{selected.email || '—'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Joined</Text><Text style={styles.infoValue}>{formatDate(selected.registered_at)}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Last Visit</Text><Text style={styles.infoValue}>{formatDate(selected.last_visit_at)}</Text></View>
        </View>
      </ScrollView>
    );
  };

  // ── Render list ────────────────────────────────────────────────────────────

  const renderList = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>CRM Members</Text>
        <Text style={styles.listCount}>{total !== null ? `${total} total` : ''}</Text>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        value={searchInput}
        onChangeText={handleSearchChange}
        placeholder="Search name, phone, email or XISH ID"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#4f46e5" />
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: '#dc2626' }}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchMembers({ pageNum: 1 })}>
            <Text style={{ color: '#4f46e5' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : members.length === 0 ? (
        <Text style={styles.emptyText}>
          {searchTerm ? 'No members matched your search.' : 'No members yet.'}
        </Text>
      ) : (
        <View>
          {members.map(renderMemberCard)}
          {hasMore && (
            <TouchableOpacity
              style={[styles.loadMoreBtn, loadingMore && { opacity: 0.6 }]}
              disabled={loadingMore}
              onPress={() => fetchMembers({ pageNum: page + 1, append: true })}
            >
              <Text style={styles.loadMoreText}>{loadingMore ? 'Loading…' : 'Load More'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {selected ? renderProfile() : renderList()}

      {/* Edit modal */}
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showEdit}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEdit(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Member Info</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Name" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} placeholder="Phone" keyboardType="phone-pad" />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary, { flex: 1 }]} onPress={() => setShowEdit(false)}>
                <Text style={[styles.btnText, { color: '#374151' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1 }, editSaving && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                <Text style={styles.btnText}>{editSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Award points modal */}
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showAward}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAward(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Award Points</Text>
              <TouchableOpacity onPress={() => setShowAward(false)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Points (use negative to deduct)</Text>
            <TextInput
              style={styles.input}
              value={awardPoints}
              onChangeText={setAwardPoints}
              placeholder="e.g. 100"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Reason</Text>
            <TextInput
              style={styles.input}
              value={awardReason}
              onChangeText={setAwardReason}
              placeholder="e.g. Birthday bonus"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary, { flex: 1 }]} onPress={() => setShowAward(false)}>
                <Text style={[styles.btnText, { color: '#374151' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1 }, awardSaving && { opacity: 0.6 }]}
                onPress={handleAwardPoints}
                disabled={awardSaving}
              >
                <Text style={styles.btnText}>{awardSaving ? 'Saving…' : 'Award'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 12 },

  // List
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  listCount: { fontSize: 13, color: '#6b7280' },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 12,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  loadMoreText: { color: '#4f46e5', fontSize: 13 },
  retryBtn: { marginTop: 8 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#4f46e5' },
  cardName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  cardPoints: { fontSize: 13, fontWeight: '700', color: '#4f46e5' },
  cardSpend: { fontSize: 12, color: '#6b7280' },
  tierBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tierBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // Profile
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtnText: { color: '#4f46e5', fontSize: 14 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  heroName: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  heroContact: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  editBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 6 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  // Section
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#6b7280', marginBottom: 10 },

  awardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  awardBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValue: { fontSize: 13, color: '#1f2937', fontWeight: '500' },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  label: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#1f2937',
  },
  btn: { borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#4f46e5' },
  btnSecondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  btnText: { fontWeight: '600', fontSize: 14, color: '#fff' },
});
