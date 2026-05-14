/**
 * ProductSelectorScreen.tsx
 *
 * Phase 9 — First-launch (or "change product") selector.
 * Shown when activeProduct is null (never chosen) or when user resets from Settings.
 *
 * Products:
 *   Chuio  — Standard Restaurant Operations
 *   XISH   — Loyalty Program Only
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useProductStore, ActiveProduct } from '../store/productStore';

const logoImage = require('../../assets/logo.png');

interface Props {
  /** If true, show a "back / cancel" button (for changing from Settings). */
  canDismiss?: boolean;
  onDismiss?: () => void;
}

export const ProductSelectorScreen: React.FC<Props> = ({ canDismiss, onDismiss }) => {
  const { setActiveProduct } = useProductStore();

  const handleSelect = async (product: ActiveProduct) => {
    await setActiveProduct(product);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Choose the product you want to use</Text>
        </View>

        {/* Cards */}
        <View style={styles.cards}>
          {/* Chuio card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect('chuio')}
            activeOpacity={0.85}
          >
            <View style={[styles.cardIcon, { backgroundColor: '#2C3E50' }]}>
              <Text style={styles.cardIconText}>🍽️</Text>
            </View>
            <Text style={styles.cardTitle}>Chuio</Text>
            <Text style={styles.cardDescription}>
              Standard restaurant operations — tables, orders, kitchen, printing, and staff management.
            </Text>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>Restaurant POS</Text>
            </View>
          </TouchableOpacity>

          {/* XISH card */}
          <TouchableOpacity
            style={[styles.card, styles.cardXish]}
            onPress={() => handleSelect('xish')}
            activeOpacity={0.85}
          >
            <View style={[styles.cardIcon, { backgroundColor: '#7C3AED' }]}>
              <Text style={styles.cardIconText}>⭐</Text>
            </View>
            <Text style={[styles.cardTitle, { color: '#7C3AED' }]}>XISH</Text>
            <Text style={styles.cardDescription}>
              Loyalty program — member management, tier rewards, wallet passes, and points redemption.
            </Text>
            <View style={[styles.cardBadge, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[styles.cardBadgeText, { color: '#7C3AED' }]}>Loyalty Program</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Dismiss / cancel (when shown from Settings) */}
        {canDismiss && onDismiss && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footer}>You can change this at any time in Settings.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 32 : 16,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  cards: {
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardXish: {
    borderColor: '#DDD6FE',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconText: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  cancelBtn: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    color: '#94a3b8',
  },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
  },
});
