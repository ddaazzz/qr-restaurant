import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {
  useSubscription,
  PREMIUM_FEATURE_LABELS,
  type PremiumFeatureKey,
} from '../contexts/SubscriptionContext';

// ---------------------------------------------------------------------------
// All premium features to display in the popup
// ---------------------------------------------------------------------------
const ALL_PREMIUM_FEATURES: Array<{ key: PremiumFeatureKey; icon: string; description: string }> = [
  { key: 'staff_management',   icon: 'people',           description: 'Manage staff accounts, roles & time attendance' },
  { key: 'reports',            icon: 'stats-chart',      description: 'Full sales reports, revenue analytics & exports' },
  { key: 'bookings',           icon: 'calendar',         description: 'Accept & manage table reservations online' },
  { key: 'printer_management', icon: 'print',            description: 'Connect thermal printers for bills, QR & kitchen tickets' },
  { key: 'bill_split',         icon: 'cut',              description: 'Split the bill between multiple guests easily' },
  { key: 'crm',                icon: 'person-circle',    description: 'Track customer history, visits & spending' },
  { key: 'item_availability',  icon: 'toggle',           description: 'Mark menu items as sold-out in real time' },
  { key: 'timed_menus',        icon: 'time',             description: 'Schedule menus to appear at specific times' },
  { key: 'payment_terminals',  icon: 'card',             description: 'Integrate KPay, Payment Asia & local terminals' },
  { key: 'loyalty_coupons',    icon: 'gift',             description: 'Create discount coupons & loyalty rewards' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface PremiumGateModalProps {
  visible: boolean;
  onClose: () => void;
  /** Highlight a specific feature that triggered the popup (optional) */
  triggeredBy?: PremiumFeatureKey | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const PremiumGateModal: React.FC<PremiumGateModalProps> = ({
  visible,
  onClose,
  triggeredBy,
}) => {
  const { isInTrial, trialEndDate } = useSubscription();

  const trialDaysLeft = isInTrial && trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleManageAccount = () => {
    Linking.openURL('https://chuio.io/login');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ── Header ─────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Crown & headline ───────────────────────── */}
            <View style={styles.crownWrapper}>
              <View style={styles.crownBadge}>
                <Ionicons name="star" size={32} color="#f59e0b" />
              </View>
            </View>
            <Text style={styles.headline}>{isInTrial ? 'Premium Trial Active' : 'Unlock Premium'}</Text>
            {isInTrial && trialDaysLeft !== null ? (
              <Text style={styles.subheadline}>
                Your free trial is active.{' '}
                <Text style={styles.trialHighlight}>
                  {trialDaysLeft === 0 ? 'It ends today' : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} remaining`}
                </Text>
                {'. Sign in to your account to manage your subscription.'}
              </Text>
            ) : (
              <Text style={styles.subheadline}>
                Premium features are managed through your Chuio account.{' '}
                Sign in to activate or manage your subscription.
              </Text>
            )}

            {/* ── Triggered-feature callout ───────────────── */}
            {triggeredBy && (
              <View style={styles.featureCallout}>
                <Ionicons name="lock-closed" size={14} color="#7c3aed" style={{ marginRight: 6 }} />
                <Text style={styles.featureCalloutText}>
                  <Text style={{ fontWeight: '700' }}>{PREMIUM_FEATURE_LABELS[triggeredBy]}</Text>
                  {' '}is a Premium feature
                </Text>
              </View>
            )}

            {/* ── Feature list ───────────────────────────── */}
            <Text style={styles.sectionTitle}>What's included in Premium</Text>
            <View style={styles.featureList}>
              {ALL_PREMIUM_FEATURES.map((f) => (
                <View
                  key={f.key}
                  style={[styles.featureRow, f.key === triggeredBy && styles.featureRowHighlighted]}
                >
                  <View style={[styles.featureIconWrapper, f.key === triggeredBy && styles.featureIconWrapperHighlighted]}>
                    <Ionicons name={f.icon as any} size={18} color={f.key === triggeredBy ? '#7c3aed' : '#4f46e5'} />
                  </View>
                  <View style={styles.featureTextBlock}>
                    <Text style={styles.featureName}>{PREMIUM_FEATURE_LABELS[f.key]}</Text>
                    <Text style={styles.featureDesc}>{f.description}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                </View>
              ))}
            </View>

            {/* ── Free vs Premium card ────────────────────── */}
            <View style={styles.tierCard}>
              <View style={styles.tierCardHalf}>
                <Text style={styles.tierCardLabel}>Free</Text>
                <Text style={styles.tierCardPrice}>HK$0</Text>
                <Text style={styles.tierCardNote}>QR Ordering + Menu + Tables + Orders + Online Payment</Text>
              </View>
              <View style={styles.tierDivider} />
              <View style={[styles.tierCardHalf, { alignItems: 'flex-end' }]}>
                <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
                <Text style={styles.tierCardPrice}>HK$500<Text style={styles.tierCardPriceSuffix}>/mo</Text></Text>
                <Text style={[styles.tierCardNote, { textAlign: 'right' }]}>Everything in Free + all Premium features</Text>
              </View>
            </View>

            {/* ── Pricing note ────────────────────────────── */}
            <Text style={styles.pricingNote}>
              HK$500 / month • 14-day free trial • Cancel anytime
            </Text>
          </ScrollView>

          {/* ── CTA Buttons ────────────────────────────────── */}
          <View style={styles.ctaContainer}>
            <TouchableOpacity style={styles.ctaPrimary} onPress={handleManageAccount} activeOpacity={0.85}>
              <Ionicons name="person-circle-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.ctaPrimaryText}>Manage Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={onClose}>
              <Text style={styles.ctaSecondaryText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  crownWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  crownBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  trialHighlight: {
    color: '#7c3aed',
    fontWeight: '700',
  },
  featureCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  featureCalloutText: {
    fontSize: 13,
    color: '#6d28d9',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  featureList: {
    gap: 4,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  featureRowHighlighted: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  featureIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconWrapperHighlighted: {
    backgroundColor: '#ddd6fe',
  },
  featureTextBlock: {
    flex: 1,
  },
  featureName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  featureDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
    lineHeight: 16,
  },
  tierCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tierCardHalf: {
    flex: 1,
    alignItems: 'flex-start',
  },
  tierDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  tierCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  proBadge: {
    backgroundColor: '#7c3aed',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tierCardPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  tierCardPriceSuffix: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
  },
  tierCardNote: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
  },
  pricingNote: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 6,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
  ctaPrimary: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  ctaSecondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  ctaSecondaryText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
  },
});
