import React, { 
  useState, 
  useEffect, 
  useCallback, 
  forwardRef, 
  useImperativeHandle,
  useRef 
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Image,
  Pressable,
} from 'react-native';
import { apiClient, API_URL } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';
import { Ionicons } from '@expo/vector-icons';
import { addonService, Addon } from '../../services/addonService';

// ==================== INTERFACES ====================

interface VariantOption {
  id: number;
  variant_id: number;
  name: string;
  price_cents: number;
}

interface Variant {
  id: number;
  item_id: number;
  name: string;
  required?: boolean;
  min_select?: number | null;
  max_select?: number | null;
  options: VariantOption[];
}

interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price_cents: number;
  category_id: number;
  available: boolean;
  image_url?: string;
  is_meal_combo?: boolean;
  variants?: Variant[];
}

interface MenuCategory {
  id: number;
  name: string;
}

export interface MenuTabRef {
  toggleEditMode: () => void;
}

// ==================== COMPONENT ====================

export const MenuTab = forwardRef<MenuTabRef, { restaurantId: string; searchQuery?: string }>(
  ({ restaurantId, searchQuery }, ref) => {
    const { t } = useTranslation();
    // ==================== STATE MANAGEMENT ====================
    
    // Data
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Edit mode - toggles item availability visibility and variant edit toggle visibility
    const [showAvailabilityToggles, setShowAvailabilityToggles] = useState(false);

    // Variant edit mode tracking - which variants are being edited
    const [editingVariantIds, setEditingVariantIds] = useState<Set<number>>(new Set());

    // Item inline editing state
    const [editingItemInlineId, setEditingItemInlineId] = useState<number | null>(null);
    const [inlineEditName, setInlineEditName] = useState('');
    const [inlineEditDescription, setInlineEditDescription] = useState('');
    const [inlineEditPrice, setInlineEditPrice] = useState('');
    const [inlineEditImageUrl, setInlineEditImageUrl] = useState('');
    const [inlineEditAvailable, setInlineEditAvailable] = useState(true);
    const [inlineEditIsMealCombo, setInlineEditIsMealCombo] = useState(false);
    const [inlineEditAddons, setInlineEditAddons] = useState<Addon[]>([]);
    const [inlineEditAddonPresets, setInlineEditAddonPresets] = useState<any[]>([]);
    const [inlineEditSelectedPresetId, setInlineEditSelectedPresetId] = useState<number | null>(null);
    const [inlineEditHasVariants, setInlineEditHasVariants] = useState(false);
    const [variantPresets, setVariantPresets] = useState<any[]>([]);
    const [inlineEditVariantPresets, setInlineEditVariantPresets] = useState<any[]>([]);
    const [inlineEditSelectedVariantPresetId, setInlineEditSelectedVariantPresetId] = useState<number | null>(null);

    // Selected items for detail view
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);

    // Category management modals
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [editingCategoryName, setEditingCategoryName] = useState('');

    // Food item management modals
    const [showItemModal, setShowItemModal] = useState(false);
    const [showEditItemModal, setShowEditItemModal] = useState(false);
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [itemName, setItemName] = useState('');
    const [itemDescription, setItemDescription] = useState('');
    const [itemPrice, setItemPrice] = useState('');
    const [editingItemName, setEditingItemName] = useState('');
    const [editingItemDescription, setEditingItemDescription] = useState('');
    const [editingItemPrice, setEditingItemPrice] = useState('');
    const [editingItemImageUrl, setEditingItemImageUrl] = useState('');
    const [itemImageUrl, setItemImageUrl] = useState('');

    // Variant management modals
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [showInlineVariantForm, setShowInlineVariantForm] = useState(false);
    const [showEditVariantModal, setShowEditVariantModal] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
    const [editingItemForVariant, setEditingItemForVariant] = useState<MenuItem | null>(null);
    const [variantName, setVariantName] = useState('');
    const [variantMinSelect, setVariantMinSelect] = useState('');
    const [variantMaxSelect, setVariantMaxSelect] = useState('');
    const [variantRequired, setVariantRequired] = useState(false);
    const [editingVariantName, setEditingVariantName] = useState('');
    const [editingVariantMinSelect, setEditingVariantMinSelect] = useState('');
    const [editingVariantMaxSelect, setEditingVariantMaxSelect] = useState('');
    const [editingVariantRequired, setEditingVariantRequired] = useState(false);

    // Variant option management
    const [showVariantOptionModal, setShowVariantOptionModal] = useState(false);
    const [showEditVariantOptionModal, setShowEditVariantOptionModal] = useState(false);
    const [editingVariantForOption, setEditingVariantForOption] = useState<Variant | null>(null);
    const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
    const [optionName, setOptionName] = useState('');
    const [optionPrice, setOptionPrice] = useState('0');
    const [editingOptionName, setEditingOptionName] = useState('');
    const [editingOptionPrice, setEditingOptionPrice] = useState('0');

    // Image upload states
    const [uploadingImageItemId, setUploadingImageItemId] = useState<number | null>(null);
    const [uploadingImageContext, setUploadingImageContext] = useState<'inline' | 'new' | 'edit' | null>(null);

    // Addon management states
    const [addons, setAddons] = useState<Addon[]>([]);
    const [showAddonModal, setShowAddonModal] = useState(false);
    const [showAddonSelectorModal, setShowAddonSelectorModal] = useState(false);
    const [loadingAddons, setLoadingAddons] = useState(false);
    const [addonSearchQuery, setAddonSearchQuery] = useState('');
    const [selectedAddonItemId, setSelectedAddonItemId] = useState<number | null>(null);
    const [addonDiscountPrice, setAddonDiscountPrice] = useState('');
    
    // Meal/Combo and Preset states
    const [editingItemIsMealCombo, setEditingItemIsMealCombo] = useState(false);
    const [showAddonPresetsDropdown, setShowAddonPresetsDropdown] = useState(false);
    const [showVariantPresetsDropdown, setShowVariantPresetsDropdown] = useState(false);
    const [showPresetPickerModal, setShowPresetPickerModal] = useState(false);
    const [presetPickerDetails, setPresetPickerDetails] = useState<Record<number, any[]>>({});
    const [loadingPresetDetails, setLoadingPresetDetails] = useState<number | null>(null);

    // ==================== REF HANDLING ====================

    useImperativeHandle(ref, () => ({
      toggleEditMode() {
        setShowAvailabilityToggles(prev => !prev);
      }
    }), []);

    // ==================== API CALLS ====================

    const loadMenuData = useCallback(async () => {
      try {
        setError(null);
        
        // Load items with variants and category info
        // Response is an array of items with category_id and category_name
        const itemsRes = await apiClient.get(
          `/api/restaurants/${restaurantId}/menu/staff`
        );
        
        const allItems = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        
        // Extract unique categories from items
        const categoryMap = new Map<number, MenuCategory>();
        allItems.forEach((item: any) => {
          if (item.category_id && item.category_name && !categoryMap.has(item.category_id)) {
            categoryMap.set(item.category_id, { id: item.category_id, name: item.category_name });
          }
        });
        const uniqueCategories = Array.from(categoryMap.values());
        
        setItems(allItems);
        setCategories(uniqueCategories);

        if (!selectedCategory && uniqueCategories.length > 0) {
          setSelectedCategory(uniqueCategories[0].id);
        }
      } catch (err: any) {
        console.error('Error fetching menu data:', err);
        setError(err.response?.data?.error || t('menu.failed-load'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, [restaurantId, selectedCategory]);

    useEffect(() => {
      loadMenuData();
    }, [restaurantId, loadMenuData]);

    const onRefresh = async () => {
      setRefreshing(true);
      await loadMenuData();
    };

    // ==================== CATEGORY OPERATIONS ====================

    const createCategory = async () => {
      if (!categoryName.trim()) {
        Alert.alert(t('common.error'), t('menu.category-required'));
        return;
      }

      try {
        await apiClient.post(
          `/api/restaurants/${restaurantId}/menu_categories`,
          { name: categoryName }
        );
        setCategoryName('');
        setShowCategoryModal(false);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-create-cat'));
      }
    };

    const updateCategory = async (categoryId: number) => {
      if (!editingCategoryName.trim()) {
        Alert.alert(t('common.error'), t('menu.category-required'));
        return;
      }

      try {
        await apiClient.patch(
          `/api/menu-categories/${categoryId}`,
          { name: editingCategoryName }
        );
        setEditingCategoryId(null);
        setEditingCategoryName('');
        setShowEditCategoryModal(false);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-update-cat'));
      }
    };

    const deleteCategory = (categoryId: number, categoryName: string) => {
      Alert.alert(
        t('menu.delete-category'),
        t('menu.delete-category-confirm').replace('{0}', categoryName),
        [
          { text: t('common.cancel') },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(
                  `/api/menu_categories/${categoryId}`,
                  { data: { restaurantId: restaurantId } }
                );
                await loadMenuData();
              } catch (err: any) {
                Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-delete-cat'));
              }
            },
          },
        ]
      );
    };

    // ==================== FOOD ITEM OPERATIONS ====================

    const createItem = async () => {
      if (!itemName.trim() || !itemPrice.trim()) {
        Alert.alert(t('common.error'), t('menu.item-name-price-required'));
        return;
      }

      if (!selectedCategory) {
        Alert.alert(t('common.error'), t('menu.select-category-first'));
        return;
      }

      try {
        await apiClient.post(
          `/api/restaurants/${restaurantId}/menu-items`,
          {
            name: itemName,
            description: itemDescription,
            price_cents: Math.round(parseFloat(itemPrice) * 100),
            category_id: selectedCategory,
            image_url: itemImageUrl || null,
            available: true,
          }
        );
        setItemName('');
        setItemDescription('');
        setItemPrice('');
        setItemImageUrl('');
        setShowItemModal(false);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-create-item'));
      }
    };

    const updateItem = async (itemId: number) => {
      if (!editingItemName.trim() || !editingItemPrice.trim()) {
        Alert.alert(t('common.error'), t('menu.item-name-price-required'));
        return;
      }

      try {
        await apiClient.patch(
          `/api/menu-items/${itemId}`,
          {
            name: editingItemName,
            description: editingItemDescription,
            price_cents: Math.round(parseFloat(editingItemPrice) * 100),
            image_url: editingItemImageUrl || null,
            is_meal_combo: editingItemIsMealCombo,
            restaurantId: restaurantId,
          }
        );
        setEditingItemId(null);
        setShowEditItemModal(false);
        await loadMenuData();
        if (selectedItem?.id === itemId) {
          const updated = items.find(i => i.id === itemId);
          if (updated) setSelectedItem(updated);
        }
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-update-item'));
      }
    };

    const deleteItem = (itemId: number, itemName: string) => {
      Alert.alert(
        t('menu.delete-item'),
        t('menu.delete-item-msg').replace('{0}', itemName),
        [
          { text: t('common.cancel') },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(
                  `/api/menu-items/${itemId}`,
                  { data: { restaurantId } }
                );
                await loadMenuData();
                if (selectedItem?.id === itemId) {
                  setShowDetailPanel(false);
                  setSelectedItem(null);
                }
              } catch (err: any) {
                Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-delete-item'));
              }
            },
          },
        ]
      );
    };

    const toggleAvailability = async (itemId: number, currentAvailable: boolean) => {
      try {
        await apiClient.patch(`/api/menu-items/${itemId}/availability`, {
          available: !currentAvailable,
          restaurantId,
        });
        setItems(items.map(item => 
          item.id === itemId ? { ...item, available: !currentAvailable } : item
        ));
        if (selectedItem?.id === itemId) {
          setSelectedItem({ ...selectedItem, available: !currentAvailable });
        }
      } catch (err: any) {
        console.error('Error updating availability:', err);
        Alert.alert(t('common.error'), t('menu.failed-avail'));
      }
    };

    // ==================== VARIANT OPERATIONS ====================

    const createVariant = async () => {
      if (!variantName.trim() || !editingItemForVariant) {
        Alert.alert(t('common.error'), t('menu.variant-name-required'));
        return;
      }

      try {
        const minSel = variantMinSelect.trim() ? parseInt(variantMinSelect) : null;
        const maxSel = variantMaxSelect.trim() ? parseInt(variantMaxSelect) : null;

        await apiClient.post(
          `/api/menu-items/${editingItemForVariant.id}/variants`,
          { 
            name: variantName,
            min_select: minSel,
            max_select: maxSel,
            required: variantRequired
          }
        );
        setVariantName('');
        setVariantMinSelect('');
        setVariantMaxSelect('');
        setVariantRequired(false);
        setShowVariantModal(false);
        setEditingItemForVariant(null);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-create-variant'));
      }
    };

    const updateVariant = async (variantId: number) => {
      if (!editingVariantName.trim()) {
        Alert.alert(t('common.error'), t('menu.variant-name-required'));
        return;
      }

      try {
        const minSel = editingVariantMinSelect.trim() ? parseInt(editingVariantMinSelect) : null;
        const maxSel = editingVariantMaxSelect.trim() ? parseInt(editingVariantMaxSelect) : null;

        await apiClient.patch(
          `/api/variants/${variantId}`,
          { 
            name: editingVariantName,
            min_select: minSel,
            max_select: maxSel,
            required: editingVariantRequired
          }
        );
        setEditingVariantId(null);
        setEditingVariantName('');
        setEditingVariantMinSelect('');
        setEditingVariantMaxSelect('');
        setEditingVariantRequired(false);
        setShowEditVariantModal(false);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-update-variant'));
      }
    };

    const deleteVariant = (variantId: number, variantName: string) => {
      Alert.alert(
        t('menu.delete-variant'),
        t('menu.delete-variant-msg'),
        [
          { text: t('common.cancel') },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(`/api/variants/${variantId}`);
                await loadMenuData();
              } catch (err: any) {
                Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-delete-variant'));
              }
            },
          },
        ]
      );
    };

    // ==================== VARIANT OPTION OPERATIONS ====================

    const createVariantOption = async () => {
      if (!optionName.trim() || !editingVariantForOption) {
        Alert.alert(t('common.error'), t('menu.option-name-required'));
        return;
      }

      try {
        await apiClient.post(
          `/api/variants/${editingVariantForOption.id}/options`,
          {
            name: optionName,
            price_cents: Math.round(parseFloat(optionPrice) * 100),
          }
        );
        setOptionName('');
        setOptionPrice('0');
        setShowVariantOptionModal(false);
        setEditingVariantForOption(null);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-create-option'));
      }
    };

    const updateVariantOption = async (optionId: number) => {
      if (!editingOptionName.trim()) {
        Alert.alert(t('common.error'), t('menu.option-name-required'));
        return;
      }

      try {
        await apiClient.patch(
          `/api/variant-options/${optionId}`,
          {
            name: editingOptionName,
            price_cents: Math.round(parseFloat(editingOptionPrice) * 100),
          }
        );
        setEditingOptionId(null);
        setEditingOptionName('');
        setEditingOptionPrice('0');
        setShowEditVariantOptionModal(false);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-update-option'));
      }
    };

    const deleteVariantOption = (optionId: number, optionName: string) => {
      Alert.alert(
        t('menu.delete-option'),
        t('menu.delete-option-msg'),
        [
          { text: t('common.cancel') },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(`/api/variant-options/${optionId}`);
                await loadMenuData();
              } catch (err: any) {
                Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-delete-option'));
              }
            },
          },
        ]
      );
    };

    // ==================== ADDON OPERATIONS ====================

    const loadAddonsForItem = async (itemId: number) => {
      try {
        setLoadingAddons(true);
        const itemAddons = await addonService.getAddonsForMenuItem(restaurantId, itemId);
        setAddons(itemAddons);
      } catch (err: any) {
        console.error('Error loading addons:', err);
        Alert.alert(t('common.error'), t('menu.failed-load-addons'));
      } finally {
        setLoadingAddons(false);
      }
    };

    const openEditItemWithAddons = async (item: MenuItem) => {
      setEditingItemId(item.id);
      setEditingItemName(item.name);
      setEditingItemDescription(item.description || '');
      setEditingItemPrice((item.price_cents / 100).toFixed(2));
      setEditingItemImageUrl(item.image_url || '');
      setEditingItemIsMealCombo(item.is_meal_combo || false);
      setShowEditItemModal(true);
      
      // Load addons for this item
      await loadAddonsForItem(item.id);
    };

    const createAddon = async () => {
      if (!editingItemId || !selectedAddonItemId || !addonDiscountPrice.trim()) {
        Alert.alert(t('common.error'), t('menu.select-item-price'));
        return;
      }

      try {
        const addonItem = items.find(i => i.id === selectedAddonItemId);
        if (!addonItem) {
          Alert.alert(t('common.error'), t('menu.item-not-found'));
          return;
        }

        await addonService.createAddon(restaurantId, {
          menu_item_id: editingItemId,
          addon_item_id: selectedAddonItemId,
          addon_name: addonItem.name,
          regular_price_cents: addonItem.price_cents,
          addon_discount_price_cents: Math.round(parseFloat(addonDiscountPrice) * 100),
        });

        setShowAddonSelectorModal(false);
        setSelectedAddonItemId(null);
        setAddonDiscountPrice('');
        setAddonSearchQuery('');
        
        // Reload addons
        await loadAddonsForItem(editingItemId);
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-add-addon'));
      }
    };

    const deleteAddon = (addonId: number, addonName: string) => {
      Alert.alert(
        t('menu.delete-addon'),
        t('menu.delete-addon-msg'),
        [
          { text: t('common.cancel') },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await addonService.deleteAddon(restaurantId, addonId);
                setAddons(addons.filter(a => a.id !== addonId));
              } catch (err: any) {
                Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-delete-addon'));
              }
            },
          },
        ]
      );
    };

    // ==================== VARIANT PRESET OPERATIONS ====================

    const loadVariantPresetsForInlineEdit = async () => {
      try {
        const res = await apiClient.get(
          `/api/restaurants/${restaurantId}/variant-presets`
        );
        const presets = Array.isArray(res.data) ? res.data : [];
        setInlineEditVariantPresets(presets);
      } catch (err: any) {
        console.error('Error loading variant presets:', err);
        Alert.alert(t('common.error'), t('menu.failed-presets'));
      }
    };

    const applyVariantPresetToInlineItem = async () => {
      if (!inlineEditSelectedVariantPresetId || !selectedItem) {
        Alert.alert(t('common.error'), t('menu.select-preset-required'));
        return;
      }

      try {
        // Fetch the variants from the preset
        const variantsRes = await apiClient.get(
          `/api/restaurants/${restaurantId}/variant-presets/${inlineEditSelectedVariantPresetId}/variants`
        );
        const variants = Array.isArray(variantsRes.data) ? variantsRes.data : [];

        if (variants.length === 0) {
          Alert.alert(t('common.error'), t('menu.no-preset-variants'));
          return;
        }

        // Add each variant from the preset
        for (const variantPresetItem of variants) {
          const variant = variantPresetItem.variant;

          // Create variant in the current item
          const newVariantRes = await apiClient.post(
            `/api/menu-items/${selectedItem.id}/variants`,
            {
              name: variant.name,
              required: variant.required || false,
              min_select: variant.min_select || 0,
              max_select: variant.max_select || 999,
            }
          );

          const newVariant = newVariantRes.data;

          // Load options for this preset variant
          const optionsRes = await apiClient.get(
            `/api/restaurants/${restaurantId}/variant-presets/${inlineEditSelectedVariantPresetId}/variants/${variantPresetItem.id}/options`
          );
          const options = Array.isArray(optionsRes.data) ? optionsRes.data : [];

          // Add each option to the new variant
          for (const option of options) {
            await apiClient.post(
              `/api/variants/${newVariant.id}/options`,
              {
                name: option.name,
                price_cents: option.price_cents || 0,
              }
            );
          }
        }

        Alert.alert(t('common.success'), t('menu.preset-added'));
        setInlineEditSelectedVariantPresetId(null);
        setShowVariantPresetsDropdown(false);

        // Reload menu data to show the new variants
        await loadMenuData();
      } catch (err: any) {
        Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-presets'));
      }
    };

    // ==================== HELPERS ====================

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const getFullImageUrl = (imageUrl?: string): string | null => {
      if (!imageUrl || !imageUrl.trim()) return null;
      if (imageUrl.startsWith('http')) return imageUrl;
      return `${API_URL}${imageUrl}`;
    };

    const uploadItemImage = async (itemId: number, context: 'inline' | 'new' | 'edit') => {
      Alert.alert(t('common.error'), t('menu.image-not-available'));
    };

    const filteredItems = items.filter(i => {
      if (selectedCategory && i.category_id !== selectedCategory) return false;
      if (searchQuery && searchQuery.trim()) {
        return i.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }
      return true;
    });

    // ==================== RENDER ====================

    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* Category Bar */}
        <View style={styles.categoryBarWrapper}>
          <ScrollView
            horizontal
            scrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            {showAvailabilityToggles && (
              <TouchableOpacity
                style={[styles.categoryBtn, styles.categoryBtnAdd]}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text style={[styles.categoryBtnText, styles.categoryBtnAddText]}>
                  {t('menu.add')}
                </Text>
              </TouchableOpacity>
            )}

            {categories.map((cat) => (
              <View key={cat.id} style={{ position: 'relative' }}>
                <TouchableOpacity
                  style={[
                    styles.categoryBtn,
                    selectedCategory === cat.id && styles.categoryBtnActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryBtnText,
                      selectedCategory === cat.id && styles.categoryBtnTextActive,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
                {/* Category edit/delete buttons - only visible when edit toggle is ON */}
                {showAvailabilityToggles && (
                  <View style={styles.categoryActionButtons}>
                    <TouchableOpacity
                      style={styles.categoryActionBtn}
                      onPress={() => {
                        setEditingCategoryId(cat.id);
                        setEditingCategoryName(cat.name);
                        setShowEditCategoryModal(true);
                      }}
                    >
                      <Text style={styles.categoryActionBtnText}>{t('menu.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.categoryActionBtn, styles.categoryActionBtnDelete]}
                      onPress={() => deleteCategory(cat.id, cat.name)}
                    >
                      <Text style={styles.categoryActionBtnText}>{t('menu.del')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Items Grid */}
        <View style={styles.itemsGridWrapper}>
          <FlatList
            data={selectedCategory && showAvailabilityToggles
              ? [...filteredItems, { id: 'add-item', name: t('menu.add-item-card'), isAddButton: true } as any]
              : filteredItems
            }
            keyExtractor={(item: any) => (item.isAddButton ? 'add-item' : item.id.toString())}
            renderItem={({ item: itemOrAdd }: any) => {
              if (itemOrAdd.isAddButton) {
                return (
                  <View style={styles.itemCardWrapper}>
                    <TouchableOpacity
                      style={[styles.itemCard, { backgroundColor: '#eff6ff', borderStyle: 'dashed' as any, borderColor: '#93c5fd' }]}
                      onPress={() => setShowItemModal(true)}
                    >
                      <View style={styles.addItemPlaceholder}>
                        <Text style={styles.addItemText}>{t('menu.add-item-card')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }

              const item = itemOrAdd as MenuItem;
              return (
                <View style={styles.itemCardWrapper}>
                  <TouchableOpacity
                    style={styles.itemCard}
                    onPress={() => {
                      setSelectedItem(item);
                      setShowDetailPanel(true);
                    }}
                  >
                    {getFullImageUrl(item.image_url) ? (
                      <Image 
                        source={{ uri: getFullImageUrl(item.image_url)! }} 
                        style={styles.itemImage}
                        onError={(error) => {
                          console.log(`Image loading error for ${item.name}:`, error.error);
                          console.log(`Image URL attempted: ${getFullImageUrl(item.image_url)}`);
                        }}
                      />
                    ) : (
                      <Image
                        source={{ uri: `${API_URL}/uploads/website/placeholder.png` }}
                        style={styles.noImage}
                      />
                    )}
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemPrice}>{formatPrice(item.price_cents)}</Text>
                        {showAvailabilityToggles && (
                          <View 
                            style={[
                              styles.availabilityBadge,
                              { backgroundColor: item.available ? '#d1f0d1' : '#fdd' }
                            ]}
                          >
                            <Text style={[styles.availabilityText, { color: item.available ? '#2d7a2d' : '#c33' }]}>
                              {item.available ? '✓' : '✕'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {showAvailabilityToggles && (
                    <View style={styles.itemActionButtons}>
                      <TouchableOpacity
                        style={styles.itemActionBtn}
                        onPress={() => toggleAvailability(item.id, item.available)}
                      >
                        <Ionicons name={item.available ? 'eye-outline' : 'eye-off-outline'} size={16} color={item.available ? '#059669' : '#dc2626'} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            }}
            numColumns={3}
            columnWrapperStyle={styles.gridRow}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('admin.no-items')}</Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        </View>

        {/* Detail Panel */}
        {showDetailPanel && selectedItem && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => { setEditingItemInlineId(null); setShowInlineVariantForm(false); setShowDetailPanel(false); }}>
                <Text style={styles.detailCloseBtn}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.detailTitle}>{editingItemInlineId === selectedItem.id ? t('menu.edit-item') : selectedItem.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {editingItemInlineId !== selectedItem.id && (
                  <TouchableOpacity
                    onPress={() => {
                      setInlineEditName(selectedItem.name);
                      setInlineEditDescription(selectedItem.description || '');
                      setInlineEditPrice((selectedItem.price_cents / 100).toFixed(2));
                      setInlineEditImageUrl(selectedItem.image_url || '');
                      setInlineEditAvailable(selectedItem.available !== false);
                      setInlineEditIsMealCombo(selectedItem.is_meal_combo || false);
                      setInlineEditHasVariants(selectedItem.variants && selectedItem.variants.length > 0);
                      setEditingItemInlineId(selectedItem.id);
                      if (selectedItem.is_meal_combo) {
                        loadAddonsForItem(selectedItem.id);
                      }
                    }}
                    style={styles.categoryActionBtn}
                  >
                    <Text style={styles.detailHeaderActionBtn}>{t('menu.edit')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.detailContent}>
              {/* Inline Edit Form */}
              {editingItemInlineId === selectedItem.id ? (
                <View style={styles.inlineEditForm}>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('menu.name')}</Text>
                    <TextInput
                      style={styles.input}
                      value={inlineEditName}
                      onChangeText={setInlineEditName}
                      placeholder={t('menu.item-name-placeholder')}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('menu.description')}</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={inlineEditDescription}
                      onChangeText={setInlineEditDescription}
                      placeholder={t('menu.item-description-placeholder')}
                      multiline
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('menu.price-dollar')}</Text>
                    <TextInput
                      style={styles.input}
                      value={inlineEditPrice}
                      onChangeText={setInlineEditPrice}
                      placeholder={t('menu.price-placeholder')}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('menu.image')}</Text>
                    {inlineEditImageUrl && (
                      <View style={styles.imagePreview}>
                        <Image
                          source={{ uri: getFullImageUrl(inlineEditImageUrl)! }}
                          style={styles.previewImage}
                        />
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary, { marginTop: 8 }]}
                      onPress={() => uploadItemImage(selectedItem!.id, 'inline')}
                      disabled={uploadingImageItemId === selectedItem!.id && uploadingImageContext === 'inline'}
                    >
                      <Text style={styles.btnText}>
                        {uploadingImageItemId === selectedItem!.id && uploadingImageContext === 'inline'
                          ? t('menu.uploading')
                          : t('menu.upload-image')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('menu.has-variants')}</Text>
                    <TouchableOpacity
                      style={[styles.checkboxRow]}
                      onPress={async () => {
                        const newValue = !inlineEditHasVariants;
                        setInlineEditHasVariants(newValue);
                        if (newValue && selectedItem) {
                          // Load variant presets when variants are enabled
                          await loadVariantPresetsForInlineEdit();
                        }
                      }}
                    >
                      <View style={[styles.checkbox, inlineEditHasVariants && styles.checkboxChecked]}>
                        {inlineEditHasVariants && <Text style={styles.checkboxCheck}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>{t('menu.enable-variants')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Add Variant Button - shown only if has variants is checked */}
                  {inlineEditHasVariants && (
                    <>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary, { marginBottom: 12 }]}
                        onPress={() => {
                          setVariantName('');
                          setVariantMinSelect('');
                          setVariantMaxSelect('');
                          setVariantRequired(false);
                          setEditingItemForVariant(selectedItem);
                          setShowInlineVariantForm(!showInlineVariantForm);
                        }}
                      >
                        <Text style={styles.btnText}>{showInlineVariantForm ? t('menu.cancel-add-variant') : t('menu.add-variant')}</Text>
                      </TouchableOpacity>

                      {showInlineVariantForm && (
                        <View style={styles.inlineVariantForm}>
                          <Text style={styles.label}>{t('menu.variant-name')}</Text>
                          <TextInput
                            style={styles.input}
                            value={variantName}
                            onChangeText={setVariantName}
                            placeholder={t('menu.variant-name-placeholder')}
                            autoFocus
                          />
                          <Text style={styles.label}>{t('menu.min-select-label')}</Text>
                          <TextInput
                            style={styles.input}
                            value={variantMinSelect}
                            onChangeText={setVariantMinSelect}
                            placeholder={t('menu.min-placeholder')}
                            keyboardType="number-pad"
                          />
                          <Text style={styles.label}>{t('menu.max-select-label')}</Text>
                          <TextInput
                            style={styles.input}
                            value={variantMaxSelect}
                            onChangeText={setVariantMaxSelect}
                            placeholder={t('menu.max-placeholder')}
                            keyboardType="number-pad"
                          />
                          <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setVariantRequired(!variantRequired)}
                          >
                            <View style={[styles.checkbox, variantRequired && styles.checkboxChecked]}>
                              {variantRequired && <Text style={styles.checkboxCheck}>✓</Text>}
                            </View>
                            <Text style={styles.checkboxLabel}>{t('menu.required-label')}</Text>
                          </TouchableOpacity>
                          <View style={styles.modalActions}>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSecondary]}
                              onPress={() => {
                                setShowInlineVariantForm(false);
                                setVariantName('');
                                setVariantMinSelect('');
                                setVariantMaxSelect('');
                                setVariantRequired(false);
                              }}
                            >
                              <Text style={styles.btnText}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnPrimary]}
                              onPress={async () => {
                                await createVariant();
                                setShowInlineVariantForm(false);
                              }}
                            >
                              <Text style={styles.btnText}>{t('menu.add-variant')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </>
                  )}

                  {/* Variant Preset Selection - shown only if has variants */}
                  {inlineEditHasVariants && (
                    <View style={styles.addonSection}>
                      <Text style={styles.label}>{t('menu.variant-presets')}</Text>
                      
                      {inlineEditVariantPresets.length > 0 ? (
                        <TouchableOpacity
                          style={[styles.btn, styles.btnSecondary, { marginTop: 4 }]}
                          onPress={async () => {
                            setShowPresetPickerModal(true);
                            // Pre-load details for all presets
                            for (const preset of inlineEditVariantPresets) {
                              if (!presetPickerDetails[preset.id]) {
                                try {
                                  setLoadingPresetDetails(preset.id);
                                  const res = await apiClient.get(
                                    `/api/restaurants/${restaurantId}/variant-presets/${preset.id}/variants`
                                  );
                                  const variants = Array.isArray(res.data) ? res.data : [];
                                  // Load options for each variant
                                  const variantsWithOptions = await Promise.all(
                                    variants.map(async (v: any) => {
                                      try {
                                        const optRes = await apiClient.get(
                                          `/api/restaurants/${restaurantId}/variant-presets/${preset.id}/variants/${v.id}/options`
                                        );
                                        return { ...v, options: Array.isArray(optRes.data) ? optRes.data : [] };
                                      } catch {
                                        return { ...v, options: [] };
                                      }
                                    })
                                  );
                                  setPresetPickerDetails(prev => ({ ...prev, [preset.id]: variantsWithOptions }));
                                } catch {
                                  setPresetPickerDetails(prev => ({ ...prev, [preset.id]: [] }));
                                }
                                setLoadingPresetDetails(null);
                              }
                            }
                          }}
                        >
                          <Text style={styles.btnText}>{t('menu.browse-presets').replace('{0}', String(inlineEditVariantPresets.length))}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.emptyText}>{t('menu.no-presets')}</Text>
                      )}
                    </View>
                  )}

                  {/* Is Combo/Meal Checkbox - right above addon section */}
                  {selectedItem && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>{t('menu.is-combo')}</Text>
                      <TouchableOpacity
                        style={[styles.checkboxRow]}
                        onPress={async () => {
                          const newValue = !inlineEditIsMealCombo;
                          setInlineEditIsMealCombo(newValue);
                          if (newValue && selectedItem) {
                            // Load addons when combo/meal is enabled
                            await loadAddonsForItem(selectedItem.id);
                          }
                        }}
                      >
                        <View style={[styles.checkbox, inlineEditIsMealCombo && styles.checkboxChecked]}>
                          {inlineEditIsMealCombo && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabel}>{t('menu.enable-addons')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Addon Selection - shown only if is combo/meal */}
                  {inlineEditIsMealCombo && (
                    <View style={styles.addonSection}>
                      <Text style={styles.label}>{t('menu.select-addons')}</Text>
                      
                      {/* Addon list */}
                      {addons.length > 0 ? (
                        <View style={styles.addonListContainer}>
                          {addons.map((addon) => (
                            <View key={addon.id} style={styles.addonItem}>
                              <View style={styles.addonInfo}>
                                <Text style={styles.addonName}>{addon.addon_name}</Text>
                                <Text style={styles.addonPrice}>
                                  {t('menu.regular-price').replace('{0}', formatPrice(addon.regular_price_cents))} → 
                                  {t('menu.addon-price').replace('{0}', formatPrice(addon.addon_discount_price_cents))}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={async () => {
                                  try {
                                    await addonService.deleteAddon(restaurantId, addon.id);
                                    if (selectedItem) {
                                      await loadAddonsForItem(selectedItem.id);
                                    }
                                  } catch (err: any) {
                                    Alert.alert(t('common.error'), t('menu.failed-remove-addon'));
                                  }
                                }}
                                style={styles.addonDeleteBtn}
                              >
                                <Text style={styles.addonDeleteBtnText}>{t('menu.del')}</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.emptyText}>{t('menu.no-addons')}</Text>
                      )}

                      {/* Add addon button */}
                      <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]}
                        onPress={() => {
                          setAddonSearchQuery('');
                          setSelectedAddonItemId(null);
                          setAddonDiscountPrice('');
                          setShowAddonSelectorModal(true);
                        }}
                      >
                        <Text style={styles.btnText}>{t('menu.add-addon')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                </View>
              ) : (
                /* Display Mode */
                <>
                  {getFullImageUrl(selectedItem.image_url) && (
                    <Image 
                      source={{ uri: getFullImageUrl(selectedItem.image_url)! }} 
                      style={styles.detailImage}
                      onError={(e) => console.log('Image failed to load:', e)}
                    />
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{t('menu.name')}</Text>
                    <Text style={styles.detailValue}>{selectedItem.name}</Text>
                  </View>

                  {selectedItem.description && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>{t('menu.description')}</Text>
                      <Text style={styles.detailValue}>{selectedItem.description}</Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{t('menu.price-label')}</Text>
                    <Text style={styles.detailValue}>{formatPrice(selectedItem.price_cents)}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{t('menu.availability')}</Text>
                    <Text style={[
                      styles.detailValue,
                      { color: selectedItem.available ? '#2d7a2d' : '#c33' }
                    ]}>
                      {selectedItem.available ? t('menu.available') : t('menu.out-of-stock')}
                    </Text>
                  </View>

                  {/* Variants Section */}
                  {selectedItem.variants && selectedItem.variants.length > 0 && (
                    <View style={styles.variantsSection}>
                      <View style={styles.variantsSectionHeader}>
                        <Text style={styles.detailLabel}>{t('menu.variants')}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setVariantName('');
                            setVariantMinSelect('');
                            setVariantMaxSelect('');
                            setVariantRequired(false);
                            setEditingItemForVariant(selectedItem);
                            setShowInlineVariantForm(!showInlineVariantForm);
                          }}
                        >
                          <Text style={styles.addBtn}>{showInlineVariantForm ? t('menu.cancel-add') : t('menu.add')}</Text>
                        </TouchableOpacity>
                      </View>

                      {showInlineVariantForm && (
                        <View style={styles.inlineVariantForm}>
                          <Text style={styles.label}>{t('menu.variant-name')}</Text>
                          <TextInput
                            style={styles.input}
                            value={variantName}
                            onChangeText={setVariantName}
                            placeholder={t('menu.variant-name-placeholder')}
                            autoFocus
                          />
                          <Text style={styles.label}>{t('menu.min-select-label')}</Text>
                          <TextInput
                            style={styles.input}
                            value={variantMinSelect}
                            onChangeText={setVariantMinSelect}
                            placeholder={t('menu.min-placeholder')}
                            keyboardType="number-pad"
                          />
                          <Text style={styles.label}>{t('menu.max-select-label')}</Text>
                          <TextInput
                            style={styles.input}
                            value={variantMaxSelect}
                            onChangeText={setVariantMaxSelect}
                            placeholder={t('menu.max-placeholder')}
                            keyboardType="number-pad"
                          />
                          <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setVariantRequired(!variantRequired)}
                          >
                            <View style={[styles.checkbox, variantRequired && styles.checkboxChecked]}>
                              {variantRequired && <Text style={styles.checkboxCheck}>✓</Text>}
                            </View>
                            <Text style={styles.checkboxLabel}>{t('menu.required-label')}</Text>
                          </TouchableOpacity>
                          <View style={styles.modalActions}>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSecondary]}
                              onPress={() => {
                                setShowInlineVariantForm(false);
                                setVariantName('');
                                setVariantMinSelect('');
                                setVariantMaxSelect('');
                                setVariantRequired(false);
                              }}
                            >
                              <Text style={styles.btnText}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnPrimary]}
                              onPress={async () => {
                                await createVariant();
                                setShowInlineVariantForm(false);
                              }}
                            >
                              <Text style={styles.btnText}>{t('menu.add-variant')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {selectedItem.variants.map((variant) => {
                        const isVariantInEditMode = editingVariantIds.has(variant.id);
                        return (
                          <View key={variant.id} style={styles.variantCard}>
                        <View style={styles.variantHeader}>
                          <Text style={styles.variantName}>{variant.name}</Text>
                          {/* Toggle button to show/hide variant edit/delete options */}
                          <TouchableOpacity
                            onPress={() => {
                              const newSet = new Set(editingVariantIds);
                              if (newSet.has(variant.id)) {
                                newSet.delete(variant.id);
                              } else {
                                newSet.add(variant.id);
                              }
                              setEditingVariantIds(newSet);
                            }}
                          >
                            <Text style={styles.variantToggleBtn}>
                              {isVariantInEditMode ? t('menu.hide') : t('menu.show')}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Variant metadata */}
                        {(variant.required || variant.min_select != null || variant.max_select != null) && (
                          <View style={{ marginBottom: 8, paddingLeft: 0 }}>
                            {variant.required && (
                              <Text style={{ fontSize: 12, color: '#d32f2f', fontWeight: '600' }}>{t('menu.required-badge')}</Text>
                            )}
                            {(variant.min_select != null || variant.max_select != null) && (
                              <Text style={{ fontSize: 12, color: '#666' }}>
                                {variant.min_select != null && t('menu.min-select').replace('{0}', String(variant.min_select))}
                                {variant.min_select != null && variant.max_select != null && ', '}
                                {variant.max_select != null && t('menu.max-select').replace('{0}', String(variant.max_select))}
                              </Text>
                            )}
                          </View>
                        )}

                        {isVariantInEditMode && (
                          <View style={styles.variantActions}>
                            <TouchableOpacity
                              style={styles.variantActionBtn}
                              onPress={() => {
                                setEditingVariantId(variant.id);
                                setEditingVariantName(variant.name);
                                setEditingVariantMinSelect(variant.min_select ? String(variant.min_select) : '');
                                setEditingVariantMaxSelect(variant.max_select ? String(variant.max_select) : '');
                                setEditingVariantRequired(variant.required || false);
                                setShowEditVariantModal(true);
                              }}
                            >
                              <Text style={styles.actionSmallBtn}>{t('menu.edit')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.variantActionBtn, styles.variantActionBtnDelete]}
                              onPress={() => deleteVariant(variant.id, variant.name)}
                            >
                              <Text style={styles.actionSmallBtnDelete}>{t('menu.delete')}</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {variant.options && variant.options.length > 0 && (
                          <View style={styles.optionsContainer}>
                            {variant.options.map((option) => (
                              <View key={option.id} style={styles.optionItem}>
                                <View>
                                  <Text style={styles.optionName}>{option.name}</Text>
                                  <Text style={styles.optionPrice}>
                                    +{formatPrice(option.price_cents)}
                                  </Text>
                                </View>
                                {/* Show option edit/delete only when variant is in edit mode */}
                                {isVariantInEditMode && (
                                  <View style={styles.optionActions}>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setEditingOptionId(option.id);
                                        setEditingOptionName(option.name);
                                        setEditingOptionPrice((option.price_cents / 100).toString());
                                        setShowEditVariantOptionModal(true);
                                      }}
                                    >
                                      <Text style={styles.actionSmallBtn}>{t('menu.edit')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => deleteVariantOption(option.id, option.name)}
                                    >
                                      <Text style={styles.actionSmallBtnDelete}>{t('menu.del')}</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                        {isVariantInEditMode && (
                          <TouchableOpacity
                            style={styles.addOptionBtn}
                            onPress={() => {
                              setEditingVariantForOption(variant);
                              setShowVariantOptionModal(true);
                            }}
                          >
                            <Text style={styles.addOptionBtnText}>{t('menu.add-option')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {(!selectedItem.variants || selectedItem.variants.length === 0) && (
                <>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]}
                    onPress={() => {
                      setVariantName('');
                      setVariantMinSelect('');
                      setVariantMaxSelect('');
                      setVariantRequired(false);
                      setEditingItemForVariant(selectedItem);
                      setShowInlineVariantForm(!showInlineVariantForm);
                    }}
                  >
                    <Text style={styles.btnText}>{showInlineVariantForm ? t('menu.cancel-add') : t('menu.add-variant')}</Text>
                  </TouchableOpacity>

                  {showInlineVariantForm && (
                    <View style={styles.inlineVariantForm}>
                      <Text style={styles.label}>{t('menu.variant-name')}</Text>
                      <TextInput
                        style={styles.input}
                        value={variantName}
                        onChangeText={setVariantName}
                        placeholder={t('menu.variant-name-placeholder')}
                        autoFocus
                      />
                      <Text style={styles.label}>{t('menu.min-select-label')}</Text>
                      <TextInput
                        style={styles.input}
                        value={variantMinSelect}
                        onChangeText={setVariantMinSelect}
                        placeholder={t('menu.min-placeholder')}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.label}>{t('menu.max-select-label')}</Text>
                      <TextInput
                        style={styles.input}
                        value={variantMaxSelect}
                        onChangeText={setVariantMaxSelect}
                        placeholder={t('menu.max-placeholder')}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setVariantRequired(!variantRequired)}
                      >
                        <View style={[styles.checkbox, variantRequired && styles.checkboxChecked]}>
                          {variantRequired && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabel}>{t('menu.required-label')}</Text>
                      </TouchableOpacity>
                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          style={[styles.btn, styles.btnSecondary]}
                          onPress={() => {
                            setShowInlineVariantForm(false);
                            setVariantName('');
                            setVariantMinSelect('');
                            setVariantMaxSelect('');
                            setVariantRequired(false);
                          }}
                        >
                          <Text style={styles.btnText}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.btn, styles.btnPrimary]}
                          onPress={async () => {
                            await createVariant();
                            setShowInlineVariantForm(false);
                          }}
                        >
                          <Text style={styles.btnText}>{t('menu.add-variant')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
                </>
              )}
            </ScrollView>

            {/* Fixed footer with Save/Cancel/Delete when in edit mode */}
            {editingItemInlineId === selectedItem.id && (
              <View style={styles.detailPanelFooter}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { flex: 1 }]}
                  onPress={() => {
                    setEditingItemInlineId(null);
                  }}
                >
                  <Text style={styles.btnText}>{t('menu.cancel-edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { flex: 2 }]}
                  onPress={async () => {
                    try {
                      await apiClient.patch(
                        `/api/menu-items/${selectedItem.id}`,
                        {
                          name: inlineEditName,
                          description: inlineEditDescription,
                          price_cents: Math.round(parseFloat(inlineEditPrice) * 100),
                          available: inlineEditAvailable,
                          is_meal_combo: inlineEditIsMealCombo,
                        }
                      );
                      setEditingItemInlineId(null);
                      await loadMenuData();
                      const updatedItems = items.filter(i => i.id === selectedItem.id);
                      if (updatedItems.length > 0) {
                        setSelectedItem(updatedItems[0]);
                      }
                    } catch (err: any) {
                      Alert.alert(t('common.error'), err.response?.data?.error || t('menu.failed-update-item'));
                    }
                  }}
                >
                  <Text style={styles.btnText}>{t('menu.save-changes')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#fee' }]}
                  onPress={() => {
                    Alert.alert(
                      t('menu.delete-item'),
                      t('menu.delete-item-msg').replace('{0}', selectedItem.name),
                      [
                        { text: t('common.cancel') },
                        {
                          text: t('common.delete'),
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await deleteItem(selectedItem.id, selectedItem.name);
                              setShowDetailPanel(false);
                              setEditingItemInlineId(null);
                            } catch (err: any) {
                              Alert.alert(t('common.error'), t('menu.failed-delete-item'));
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={{ color: '#c33', fontWeight: '600', fontSize: 13 }}>{t('menu.delete')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Variant Preset Picker Modal */}
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showPresetPickerModal}
          animationType="fade"
          transparent
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%', width: '85%' }]}>
              <Text style={styles.modalTitle}>{t('menu.variant-presets-title')}</Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                {t('menu.select-preset-msg')}
              </Text>

              <ScrollView style={{ maxHeight: 400 }}>
                {inlineEditVariantPresets.map((preset) => {
                  const details = presetPickerDetails[preset.id];
                  const isSelected = inlineEditSelectedVariantPresetId === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        {
                          backgroundColor: isSelected ? '#eff6ff' : '#f9fafb',
                          borderWidth: 1,
                          borderColor: isSelected ? '#3b82f6' : '#e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 10,
                        },
                      ]}
                      onPress={() => setInlineEditSelectedVariantPresetId(isSelected ? null : preset.id)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>{preset.name}</Text>
                        {isSelected && <Text style={{ fontSize: 18, color: '#3b82f6' }}>✓</Text>}
                      </View>

                      {details && details.length > 0 ? (
                        <View style={{ marginTop: 8 }}>
                          {details.map((v: any, vi: number) => (
                            <View key={vi} style={{ marginBottom: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
                                {v.variant?.name || v.name}
                                {v.variant?.required && <Text style={{ color: '#d32f2f' }}> *</Text>}
                              </Text>
                              {v.options && v.options.length > 0 && (
                                <View style={{ marginLeft: 12, marginTop: 2 }}>
                                  {v.options.map((opt: any, oi: number) => (
                                    <Text key={oi} style={{ fontSize: 12, color: '#6b7280', lineHeight: 18 }}>
                                      • {opt.name}{opt.price_cents ? ` (+$${(opt.price_cents / 100).toFixed(2)})` : ''}
                                    </Text>
                                  ))}
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      ) : loadingPresetDetails === preset.id ? (
                        <ActivityIndicator size="small" style={{ marginTop: 8 }} />
                      ) : details && details.length === 0 ? (
                        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{t('menu.no-variants-preset')}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.modalActions, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowPresetPickerModal(false);
                    setInlineEditSelectedVariantPresetId(null);
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, !inlineEditSelectedVariantPresetId && { opacity: 0.5 }]}
                  disabled={!inlineEditSelectedVariantPresetId}
                  onPress={() => {
                    const selectedPreset = inlineEditVariantPresets.find(
                      (p) => p.id === inlineEditSelectedVariantPresetId
                    );
                    Alert.alert(
                      t('menu.apply-preset'),
                      t('menu.apply-preset-msg').replace('{0}', selectedPreset?.name || ''),
                      [
                        { text: t('common.cancel') },
                        {
                          text: t('menu.apply'),
                          onPress: async () => {
                            setShowPresetPickerModal(false);
                            await applyVariantPresetToInlineItem();
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.btnText}>{t('menu.apply-preset')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ==================== MODALS ==================== */}

        {/* Category Modals */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showCategoryModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.new-category')}</Text>

              <Text style={styles.label}>{t('menu.category-name')}</Text>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder={t('menu.category-placeholder')}
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowCategoryModal(false)}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createCategory}
                >
                  <Text style={styles.btnText}>{t('menu.create')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showEditCategoryModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.edit-category')}</Text>

              <Text style={styles.label}>{t('menu.category-name')}</Text>
              <TextInput
                style={styles.input}
                value={editingCategoryName}
                onChangeText={setEditingCategoryName}
                placeholder={t('menu.category-placeholder')}
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowEditCategoryModal(false);
                    setEditingCategoryId(null);
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingCategoryId && updateCategory(editingCategoryId)}
                >
                  <Text style={styles.btnText}>{t('menu.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Item Modals */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showItemModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.new-food-item')}</Text>

              <Text style={styles.label}>{t('menu.item-name')}</Text>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholder={t('menu.item-name-placeholder')}
                autoFocus
              />

              <Text style={styles.label}>{t('menu.description')}</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={itemDescription}
                onChangeText={setItemDescription}
                placeholder={t('menu.item-description-placeholder')}
                multiline
              />

              <Text style={styles.label}>{t('menu.price-dollar')}</Text>
              <TextInput
                style={styles.input}
                value={itemPrice}
                onChangeText={setItemPrice}
                placeholder={t('menu.price-placeholder-example')}
                keyboardType="decimal-pad"
              />

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('menu.price-optional-image')}</Text>
                {itemImageUrl && (
                  <View style={styles.imagePreview}>
                    <Image
                      source={{ uri: getFullImageUrl(itemImageUrl)! }}
                      style={styles.previewImage}
                    />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginTop: 8 }]}
                  onPress={() => uploadItemImage(0, 'new')}
                  disabled={uploadingImageItemId === 0 && uploadingImageContext === 'new'}
                >
                  <Text style={styles.btnText}>
                    {uploadingImageItemId === 0 && uploadingImageContext === 'new'
                      ? t('menu.uploading')
                      : t('menu.upload-image')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowItemModal(false)}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createItem}
                >
                  <Text style={styles.btnText}>{t('menu.create')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showEditItemModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.edit-modal-title')}</Text>

              <Text style={styles.label}>{t('menu.item-name')}</Text>
              <TextInput
                style={styles.input}
                value={editingItemName}
                onChangeText={setEditingItemName}
                placeholder={t('menu.item-name-placeholder')}
                autoFocus
              />

              <Text style={styles.label}>{t('menu.description')}</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={editingItemDescription}
                onChangeText={setEditingItemDescription}
                placeholder={t('menu.item-description-placeholder')}
                multiline
              />

              <Text style={styles.label}>{t('menu.price-dollar')}</Text>
              <TextInput
                style={styles.input}
                value={editingItemPrice}
                onChangeText={setEditingItemPrice}
                placeholder={t('menu.price-placeholder-example')}
                keyboardType="decimal-pad"
              />

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('menu.price-optional-image')}</Text>
                {editingItemImageUrl && (
                  <View style={styles.imagePreview}>
                    <Image
                      source={{ uri: getFullImageUrl(editingItemImageUrl)! }}
                      style={styles.previewImage}
                    />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginTop: 8 }]}
                  onPress={() => editingItemId && uploadItemImage(editingItemId, 'edit')}
                  disabled={uploadingImageItemId === editingItemId && uploadingImageContext === 'edit'}
                >
                  <Text style={styles.btnText}>
                    {uploadingImageItemId === editingItemId && uploadingImageContext === 'edit'
                      ? t('menu.uploading')
                      : t('menu.upload-image')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Meal/Combo and Variants Checkboxes */}
              <View style={[styles.formGroup, { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ddd' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => setEditingItemIsMealCombo(!editingItemIsMealCombo)}
                  >
                    <View style={{
                      width: 18,
                      height: 18,
                      borderWidth: 2,
                      borderColor: editingItemIsMealCombo ? '#4CAF50' : '#ddd',
                      borderRadius: 3,
                      backgroundColor: editingItemIsMealCombo ? '#4CAF50' : 'transparent',
                      marginRight: 8,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      {editingItemIsMealCombo && <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{t('menu.is-meal-combo')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Addon Configuration Section - only shown if meal/combo is enabled */}
              {editingItemIsMealCombo && (
              <View style={[styles.formGroup, { marginTop: 16, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.label, { fontSize: 14, fontWeight: '600', margin: 0 }]}>{t('menu.available-addons')}</Text>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { paddingHorizontal: 12, paddingVertical: 6 }]}
                    onPress={() => setShowAddonSelectorModal(true)}
                  >
                    <Text style={[styles.btnText, { fontSize: 12 }]}>{t('menu.add-addon-btn')}</Text>
                  </TouchableOpacity>
                </View>

                {loadingAddons ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : addons.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', paddingVertical: 15 }}>
                    {t('menu.no-addons-config')}
                  </Text>
                ) : (
                  <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 4, overflow: 'hidden' }}>
                    {addons.map((addon, idx) => (
                      <View key={addon.id} style={[
                        { padding: 10, backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9', borderBottomWidth: idx < addons.length - 1 ? 1 : 0, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
                      ]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '500', marginBottom: 4 }}>{addon.addon_name}</Text>
                          <Text style={{ fontSize: 11, color: '#666' }}>
                            {t('menu.regular-price').replace('{0}', '$' + (addon.regular_price_cents / 100).toFixed(2))} | {t('menu.addon-price').replace('{0}', '$' + (addon.addon_discount_price_cents / 100).toFixed(2))}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{ paddingLeft: 8 }}
                          onPress={() => deleteAddon(addon.id, addon.addon_name)}
                        >
                          <Text style={{ fontSize: 16, color: '#e74c3c' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowEditItemModal(false)}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingItemId && updateItem(editingItemId)}
                >
                  <Text style={styles.btnText}>{t('menu.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Addon Selector Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showAddonSelectorModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.add-addon-item')}</Text>

              <Text style={styles.label}>{t('menu.search-items')}</Text>
              <TextInput
                style={styles.input}
                value={addonSearchQuery}
                onChangeText={setAddonSearchQuery}
                placeholder={t('menu.search-placeholder')}
              />

              <Text style={styles.label}>{t('menu.select-item')}</Text>
              <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 4, maxHeight: 250 }}>
                <FlatList
                  data={items.filter(i => 
                    i.id !== editingItemId && 
                    !addons.some(a => a.addon_item_id === i.id) &&
                    i.name.toLowerCase().includes(addonSearchQuery.toLowerCase())
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={true}
                  renderItem={({ item: addonItem }) => (
                    <TouchableOpacity
                      style={[
                        styles.input,
                        {
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: '#eee',
                          backgroundColor: selectedAddonItemId === addonItem.id ? '#e8f5e9' : 'white',
                        }
                      ]}
                      onPress={() => setSelectedAddonItemId(addonItem.id)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '500' }}>{addonItem.name}</Text>
                          <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                            ${(addonItem.price_cents / 100).toFixed(2)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 18, color: selectedAddonItemId === addonItem.id ? '#4caf50' : '#ccc' }}>
                          {selectedAddonItemId === addonItem.id ? '●' : '○'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={{ paddingVertical: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>
                      {t('menu.no-items-available')}
                    </Text>
                  }
                />
              </View>

              {selectedAddonItemId && (
                <>
                  <Text style={styles.label}>{t('menu.addon-discount-price')}</Text>
                  <TextInput
                    style={styles.input}
                    value={addonDiscountPrice}
                    onChangeText={setAddonDiscountPrice}
                    placeholder={t('menu.price-placeholder-decimal')}
                    keyboardType="decimal-pad"
                  />
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowAddonSelectorModal(false);
                    setSelectedAddonItemId(null);
                    setAddonDiscountPrice('');
                    setAddonSearchQuery('');
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                {selectedAddonItemId && (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={createAddon}
                  >
                    <Text style={styles.btnText}>{t('menu.confirm-btn')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showVariantModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.new-variant')}</Text>

              <Text style={styles.label}>{t('menu.variant-name')}</Text>
              <TextInput
                style={styles.input}
                value={variantName}
                onChangeText={setVariantName}
                placeholder={t('menu.variant-name-placeholder')}
                autoFocus
              />

              <Text style={styles.label}>{t('menu.min-select-label')}</Text>
              <TextInput
                style={styles.input}
                value={variantMinSelect}
                onChangeText={setVariantMinSelect}
                placeholder={t('menu.min-placeholder')}
                keyboardType="number-pad"
              />

              <Text style={styles.label}>{t('menu.max-select-label')}</Text>
              <TextInput
                style={styles.input}
                value={variantMaxSelect}
                onChangeText={setVariantMaxSelect}
                placeholder={t('menu.max-placeholder')}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setVariantRequired(!variantRequired)}
              >
                <View style={[styles.checkbox, variantRequired && styles.checkboxChecked]}>
                  {variantRequired && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>{t('menu.required-label')}</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowVariantModal(false);
                    setEditingItemForVariant(null);
                    setVariantName('');
                    setVariantMinSelect('');
                    setVariantMaxSelect('');
                    setVariantRequired(false);
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createVariant}
                >
                  <Text style={styles.btnText}>{t('menu.create')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showEditVariantModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.edit-variant')}</Text>

              <Text style={styles.label}>{t('menu.variant-name')}</Text>
              <TextInput
                style={styles.input}
                value={editingVariantName}
                onChangeText={setEditingVariantName}
                placeholder={t('menu.variant-name-placeholder')}
                autoFocus
              />

              <Text style={styles.label}>{t('menu.min-select-label')}</Text>
              <TextInput
                style={styles.input}
                value={editingVariantMinSelect}
                onChangeText={setEditingVariantMinSelect}
                placeholder={t('menu.min-placeholder')}
                keyboardType="number-pad"
              />

              <Text style={styles.label}>{t('menu.max-select-label')}</Text>
              <TextInput
                style={styles.input}
                value={editingVariantMaxSelect}
                onChangeText={setEditingVariantMaxSelect}
                placeholder={t('menu.max-placeholder')}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setEditingVariantRequired(!editingVariantRequired)}
              >
                <View style={[styles.checkbox, editingVariantRequired && styles.checkboxChecked]}>
                  {editingVariantRequired && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>{t('menu.required-label')}</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowEditVariantModal(false);
                    setEditingVariantId(null);
                    setEditingVariantName('');
                    setEditingVariantMinSelect('');
                    setEditingVariantMaxSelect('');
                    setEditingVariantRequired(false);
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingVariantId && updateVariant(editingVariantId)}
                >
                  <Text style={styles.btnText}>{t('menu.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Variant Option Modals */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showVariantOptionModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.new-option')}</Text>

              <Text style={styles.label}>{t('menu.option-name')}</Text>
              <TextInput
                style={styles.input}
                value={optionName}
                onChangeText={setOptionName}
                placeholder={t('menu.option-name-placeholder')}
                autoFocus
              />

              <Text style={styles.label}>{t('menu.price-addon')}</Text>
              <TextInput
                style={styles.input}
                value={optionPrice}
                onChangeText={setOptionPrice}
                placeholder={t('menu.price-placeholder-decimal')}
                keyboardType="decimal-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowVariantOptionModal(false);
                    setEditingVariantForOption(null);
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createVariantOption}
                >
                  <Text style={styles.btnText}>{t('menu.create')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showEditVariantOptionModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('menu.edit-option')}</Text>

              <Text style={styles.label}>{t('menu.option-name')}</Text>
              <TextInput
                style={styles.input}
                value={editingOptionName}
                onChangeText={setEditingOptionName}
                placeholder={t('menu.option-name-placeholder')}
                autoFocus
              />

              <Text style={styles.label}>{t('menu.price-addon')}</Text>
              <TextInput
                style={styles.input}
                value={editingOptionPrice}
                onChangeText={setEditingOptionPrice}
                placeholder={t('menu.price-placeholder-decimal')}
                keyboardType="decimal-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowEditVariantOptionModal(false);
                    setEditingOptionId(null);
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingOptionId && updateVariantOption(editingOptionId)}
                >
                  <Text style={styles.btnText}>{t('menu.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    );
  }
);

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Category Bar - ISOLATED CONTEXT (no flex growth)
  categoryBarWrapper: {
    flex: 0,
    height: 48,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexShrink: 0,
  },
  categoryScroll: {
    backgroundColor: '#fff',
    height: 48,
    flexShrink: 0,
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  categoryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 4,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryBtnTextActive: {
    color: '#ffffff',
  },
  categoryBtnAdd: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
    borderStyle: 'dashed',
  },
  categoryBtnAddText: {
    color: '#3b82f6',
  },
  categoryActionButtons: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  categoryActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  categoryActionBtnDelete: {
    backgroundColor: '#ef4444',
  },
  categoryActionBtnText: {
    fontSize: 14,
  },

  // Items Grid - ISOLATED CONTEXT (fills remaining space)
  itemsGridWrapper: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    flexShrink: 1,
  },
  listContent: {
    padding: 12,
    flexGrow: 0,
  },
  gridRow: {
    justifyContent: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  itemCardWrapper: {
    width: '31%',
    maxWidth: '31%',
    position: 'relative',
  },
  itemCard: {
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemImage: {
    width: '100%',
    aspectRatio: 2.2,
    backgroundColor: '#f0f0f0',
  },
  noImage: {
    width: '100%',
    aspectRatio: 2.2,
    backgroundColor: '#f0f0f0',
    resizeMode: 'cover',
  },
  noImageText: {
    fontSize: 32,
  },
  itemContent: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
  },
  availabilityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemActionButtons: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  itemActionBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  itemActionBtnDelete: {
    backgroundColor: 'rgba(255, 100, 100, 0.9)',
  },
  itemActionBtnText: {
    fontSize: 16,
  },
  addItemPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3b82f6',
  },

  // Detail Panel
  detailPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '42%',
    backgroundColor: '#fff',
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
    zIndex: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  detailCloseBtn: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: '500',
    width: 24,
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 8,
    width: 24,
    justifyContent: 'flex-end',
  },
  detailHeaderActionBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#dbeafe',
    borderRadius: 4,
  },
  detailHeaderActionBtnDelete: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  detailContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  detailPanelFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  inlineVariantForm: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  detailImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  detailSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },

  // Inline Edit Form
  inlineEditForm: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
    color: '#1f2937',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Variants Section
  variantsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  variantsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  variantCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  variantName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  variantToggleBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#dbeafe',
  },
  variantActions: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  variantActionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: '#dbeafe',
  },
  variantActionBtnDelete: {
    backgroundColor: '#fee2e2',
  },
  actionSmallBtn: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: '#dbeafe',
  },
  actionSmallBtnDelete: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: '#fee2e2',
  },
  optionsContainer: {
    marginBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    marginBottom: 4,
  },
  optionName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
  },
  optionPrice: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  optionActions: {
    flexDirection: 'row',
    gap: 4,
  },
  addOptionBtn: {
    backgroundColor: '#dbeafe',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  addOptionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  addBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#dbeafe',
    borderRadius: 3,
  },

  // Buttons
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
  },
  btnSecondary: {
    backgroundColor: '#e5e7eb',
  },
  btnText: {
    fontWeight: '600',
    fontSize: 13,
    color: '#1f2937',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },

  // Empty & Error
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    margin: 12,
  },
  errorText: {
    color: '#c33',
    fontSize: 13,
  },

  // Image Preview
  imagePreview: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    height: 200,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Checkbox styles
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },

  // Addon section styles
  addonSection: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  addonListContainer: {
    backgroundColor: '#fff',
    borderRadius: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  addonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  addonInfo: {
    flex: 1,
  },
  addonName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  addonPrice: {
    fontSize: 12,
    color: '#6b7280',
  },
  addonDeleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
  addonDeleteBtnText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#6b7280',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#dbeafe',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1f2937',
  },
  dropdownItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});