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

export const MenuTab = forwardRef<MenuTabRef, { restaurantId: string }>(
  ({ restaurantId }, ref) => {
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
    const [showEditVariantModal, setShowEditVariantModal] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
    const [editingItemForVariant, setEditingItemForVariant] = useState<MenuItem | null>(null);
    const [variantName, setVariantName] = useState('');
    const [editingVariantName, setEditingVariantName] = useState('');

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
        setError(err.response?.data?.error || 'Failed to load menu');
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
        Alert.alert('Error', 'Category name required');
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
        Alert.alert('Error', err.response?.data?.error || 'Failed to create category');
      }
    };

    const updateCategory = async (categoryId: number) => {
      if (!editingCategoryName.trim()) {
        Alert.alert('Error', 'Category name required');
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
        Alert.alert('Error', err.response?.data?.error || 'Failed to update category');
      }
    };

    const deleteCategory = (categoryId: number, categoryName: string) => {
      Alert.alert(
        'Delete Category',
        `Are you sure you want to delete "${categoryName}"?`,
        [
          { text: 'Cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(
                  `/api/menu_categories/${categoryId}`,
                  { data: { restaurantId } }
                );
                await loadMenuData();
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || 'Failed to delete category');
              }
            },
          },
        ]
      );
    };

    // ==================== FOOD ITEM OPERATIONS ====================

    const createItem = async () => {
      if (!itemName.trim() || !itemPrice.trim()) {
        Alert.alert('Error', 'Item name and price required');
        return;
      }

      if (!selectedCategory) {
        Alert.alert('Error', 'Select a category first');
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
        Alert.alert('Error', err.response?.data?.error || 'Failed to create item');
      }
    };

    const updateItem = async (itemId: number) => {
      if (!editingItemName.trim() || !editingItemPrice.trim()) {
        Alert.alert('Error', 'Item name and price required');
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
        Alert.alert('Error', err.response?.data?.error || 'Failed to update item');
      }
    };

    const deleteItem = (itemId: number, itemName: string) => {
      Alert.alert(
        'Delete Item',
        `Are you sure you want to delete "${itemName}"?`,
        [
          { text: 'Cancel' },
          {
            text: 'Delete',
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
                Alert.alert('Error', err.response?.data?.error || 'Failed to delete item');
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
        Alert.alert('Error', 'Failed to update availability');
      }
    };

    // ==================== VARIANT OPERATIONS ====================

    const createVariant = async () => {
      if (!variantName.trim() || !editingItemForVariant) {
        Alert.alert('Error', 'Variant name required');
        return;
      }

      try {
        await apiClient.post(
          `/api/menu-items/${editingItemForVariant.id}/variants`,
          { name: variantName }
        );
        setVariantName('');
        setShowVariantModal(false);
        setEditingItemForVariant(null);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.error || 'Failed to create variant');
      }
    };

    const updateVariant = async (variantId: number) => {
      if (!editingVariantName.trim()) {
        Alert.alert('Error', 'Variant name required');
        return;
      }

      try {
        await apiClient.patch(
          `/api/variants/${variantId}`,
          { name: editingVariantName }
        );
        setEditingVariantId(null);
        setEditingVariantName('');
        setShowEditVariantModal(false);
        await loadMenuData();
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.error || 'Failed to update variant');
      }
    };

    const deleteVariant = (variantId: number, variantName: string) => {
      Alert.alert(
        'Delete Variant',
        `Are you sure you want to delete "${variantName}"?`,
        [
          { text: 'Cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(`/api/variants/${variantId}`);
                await loadMenuData();
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || 'Failed to delete variant');
              }
            },
          },
        ]
      );
    };

    // ==================== VARIANT OPTION OPERATIONS ====================

    const createVariantOption = async () => {
      if (!optionName.trim() || !editingVariantForOption) {
        Alert.alert('Error', 'Option name required');
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
        Alert.alert('Error', err.response?.data?.error || 'Failed to create option');
      }
    };

    const updateVariantOption = async (optionId: number) => {
      if (!editingOptionName.trim()) {
        Alert.alert('Error', 'Option name required');
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
        Alert.alert('Error', err.response?.data?.error || 'Failed to update option');
      }
    };

    const deleteVariantOption = (optionId: number, optionName: string) => {
      Alert.alert(
        'Delete Option',
        `Are you sure you want to delete "${optionName}"?`,
        [
          { text: 'Cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(`/api/variant-options/${optionId}`);
                await loadMenuData();
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || 'Failed to delete option');
              }
            },
          },
        ]
      );
    };

    // ==================== HELPERS ====================

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const getFullImageUrl = (imageUrl?: string): string | null => {
      if (!imageUrl || !imageUrl.trim()) return null;
      if (imageUrl.startsWith('http')) return imageUrl;
      return `${API_URL}${imageUrl}`;
    };

    const uploadItemImage = async (itemId: number, context: 'inline' | 'new' | 'edit') => {
      Alert.alert('Not Available', 'Image upload is not available in this version');
    };

    const filteredItems = selectedCategory
      ? items.filter(i => i.category_id === selectedCategory)
      : items;

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
                  + Add
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
                      <Text style={styles.categoryActionBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.categoryActionBtn, styles.categoryActionBtnDelete]}
                      onPress={() => deleteCategory(cat.id, cat.name)}
                    >
                      <Text style={styles.categoryActionBtnText}>🗑️</Text>
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
            data={selectedCategory
              ? [...filteredItems, { id: 'add-item', name: '+ Add Item', isAddButton: true } as any]
              : filteredItems
            }
            keyExtractor={(item: any) => (item.isAddButton ? 'add-item' : item.id.toString())}
            renderItem={({ item: itemOrAdd }: any) => {
              if (itemOrAdd.isAddButton) {
                return (
                  <View style={styles.itemCardWrapper}>
                    <TouchableOpacity
                      style={[styles.itemCard, { backgroundColor: '#e8e8e8' }]}
                      onPress={() => setShowItemModal(true)}
                    >
                      <View style={styles.addItemPlaceholder}>
                        <Text style={styles.addItemText}>+ Add Item</Text>
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
                      <View style={styles.noImage}>
                        <Text style={styles.noImageText}>📸</Text>
                      </View>
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
                        <Text style={styles.itemActionBtnText}>{item.available ? '👁️' : '🚫'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            }}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No items in this category</Text>
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
              <TouchableOpacity onPress={() => setShowDetailPanel(false)}>
                <Text style={styles.detailCloseBtn}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.detailTitle}>Item Details</Text>
              {/* Item edit button - toggle inline editing */}
              <TouchableOpacity
                onPress={() => {
                  if (editingItemInlineId === selectedItem.id) {
                    setEditingItemInlineId(null);
                  } else {
                    setEditingItemInlineId(selectedItem.id);
                    setInlineEditName(selectedItem.name);
                    setInlineEditDescription(selectedItem.description || '');
                    setInlineEditPrice((selectedItem.price_cents / 100).toString());
                    setInlineEditImageUrl(selectedItem.image_url || '');
                  }
                }}
                style={styles.categoryActionBtn}
              >
                <Text style={styles.detailHeaderActionBtn}>
                  {editingItemInlineId === selectedItem.id ? '✕' : '✏️'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailContent}>
              {/* Inline Edit Form */}
              {editingItemInlineId === selectedItem.id ? (
                <View style={styles.inlineEditForm}>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={inlineEditName}
                      onChangeText={setInlineEditName}
                      placeholder="Item name"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={inlineEditDescription}
                      onChangeText={setInlineEditDescription}
                      placeholder="Item description"
                      multiline
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Price ($)</Text>
                    <TextInput
                      style={styles.input}
                      value={inlineEditPrice}
                      onChangeText={setInlineEditPrice}
                      placeholder="Price"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Image</Text>
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
                          ? '⏳ Uploading...'
                          : '📸 Upload Image'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={() => {
                        setEditingItemInlineId(null);
                      }}
                    >
                      <Text style={styles.btnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary]}
                      onPress={async () => {
                        try {
                          await apiClient.patch(
                            `/api/menu-items/${selectedItem.id}`,
                            {
                              name: inlineEditName,
                              description: inlineEditDescription,
                              price_cents: Math.round(parseFloat(inlineEditPrice) * 100),
                            }
                          );
                          setEditingItemInlineId(null);
                          await loadMenuData();
                          // Reload selected item
                          const updatedItems = items.filter(i => i.id === selectedItem.id);
                          if (updatedItems.length > 0) {
                            setSelectedItem(updatedItems[0]);
                          }
                        } catch (err: any) {
                          Alert.alert('Error', err.response?.data?.error || 'Failed to update item');
                        }
                      }}
                    >
                      <Text style={styles.btnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: '#fee' }]}
                      onPress={() => {
                        Alert.alert(
                          'Delete Item',
                          `Are you sure you want to delete "${selectedItem.name}"?`,
                          [
                            { text: 'Cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await deleteItem(selectedItem.id, selectedItem.name);
                                  setShowDetailPanel(false);
                                } catch (err: any) {
                                  Alert.alert('Error', 'Failed to delete item');
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={{ color: '#c33', fontWeight: '600', fontSize: 13 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
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
                    <Text style={styles.detailLabel}>Name</Text>
                    <Text style={styles.detailValue}>{selectedItem.name}</Text>
                  </View>

                  {selectedItem.description && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>{selectedItem.description}</Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={styles.detailValue}>{formatPrice(selectedItem.price_cents)}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Availability</Text>
                    <Text style={[
                      styles.detailValue,
                      { color: selectedItem.available ? '#2d7a2d' : '#c33' }
                    ]}>
                      {selectedItem.available ? '✓ Available' : '✕ Out of Stock'}
                    </Text>
                  </View>

                  {/* Variants Section */}
                  {selectedItem.variants && selectedItem.variants.length > 0 && (
                    <View style={styles.variantsSection}>
                      <View style={styles.variantsSectionHeader}>
                        <Text style={styles.detailLabel}>Variants</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingItemForVariant(selectedItem);
                            setShowVariantModal(true);
                          }}
                        >
                          <Text style={styles.addBtn}>+ Add</Text>
                        </TouchableOpacity>
                      </View>

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
                              {isVariantInEditMode ? '▼ Hide' : '▶ Show'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {isVariantInEditMode && (
                          <View style={styles.variantActions}>
                            <TouchableOpacity
                              style={styles.variantActionBtn}
                              onPress={() => {
                                setEditingVariantId(variant.id);
                                setEditingVariantName(variant.name);
                                setShowEditVariantModal(true);
                              }}
                            >
                              <Text style={styles.actionSmallBtn}>✏️ Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.variantActionBtn, styles.variantActionBtnDelete]}
                              onPress={() => deleteVariant(variant.id, variant.name)}
                            >
                              <Text style={styles.actionSmallBtnDelete}>🗑️ Delete</Text>
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
                                      <Text style={styles.actionSmallBtn}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => deleteVariantOption(option.id, option.name)}
                                    >
                                      <Text style={styles.actionSmallBtnDelete}>Del</Text>
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
                            <Text style={styles.addOptionBtnText}>+ Add Option</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {(!selectedItem.variants || selectedItem.variants.length === 0) && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]}
                  onPress={() => {
                    setEditingItemForVariant(selectedItem);
                    setShowVariantModal(true);
                  }}
                >
                  <Text style={styles.btnText}>+ Add Variant</Text>
                </TouchableOpacity>
              )}
                </>
              )}
            </ScrollView>
          </View>
        )}

        {/* ==================== MODALS ==================== */}

        {/* Category Modals */}
        <Modal visible={showCategoryModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Category</Text>

              <Text style={styles.label}>Category Name</Text>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="e.g., Appetizers"
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowCategoryModal(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createCategory}
                >
                  <Text style={styles.btnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showEditCategoryModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Category</Text>

              <Text style={styles.label}>Category Name</Text>
              <TextInput
                style={styles.input}
                value={editingCategoryName}
                onChangeText={setEditingCategoryName}
                placeholder="e.g., Appetizers"
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
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingCategoryId && updateCategory(editingCategoryId)}
                >
                  <Text style={styles.btnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Item Modals */}
        <Modal visible={showItemModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>New Food Item</Text>

              <Text style={styles.label}>Item Name</Text>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g., Grilled Salmon"
                autoFocus
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={itemDescription}
                onChangeText={setItemDescription}
                placeholder="Item description"
                multiline
              />

              <Text style={styles.label}>Price ($)</Text>
              <TextInput
                style={styles.input}
                value={itemPrice}
                onChangeText={setItemPrice}
                placeholder="12.99"
                keyboardType="decimal-pad"
              />

              <View style={styles.formGroup}>
                <Text style={styles.label}>Image (Optional)</Text>
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
                      ? '⏳ Uploading...'
                      : '📸 Upload Image'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowItemModal(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createItem}
                >
                  <Text style={styles.btnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={showEditItemModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Item</Text>

              <Text style={styles.label}>Item Name</Text>
              <TextInput
                style={styles.input}
                value={editingItemName}
                onChangeText={setEditingItemName}
                placeholder="e.g., Grilled Salmon"
                autoFocus
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={editingItemDescription}
                onChangeText={setEditingItemDescription}
                placeholder="Item description"
                multiline
              />

              <Text style={styles.label}>Price ($)</Text>
              <TextInput
                style={styles.input}
                value={editingItemPrice}
                onChangeText={setEditingItemPrice}
                placeholder="12.99"
                keyboardType="decimal-pad"
              />

              <View style={styles.formGroup}>
                <Text style={styles.label}>Image (Optional)</Text>
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
                      ? '⏳ Uploading...'
                      : '📸 Upload Image'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowEditItemModal(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingItemId && updateItem(editingItemId)}
                >
                  <Text style={styles.btnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Variant Modals */}
        <Modal visible={showVariantModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Variant</Text>

              <Text style={styles.label}>Variant Name</Text>
              <TextInput
                style={styles.input}
                value={variantName}
                onChangeText={setVariantName}
                placeholder="e.g., Size, Temperature"
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowVariantModal(false);
                    setEditingItemForVariant(null);
                  }}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createVariant}
                >
                  <Text style={styles.btnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showEditVariantModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Variant</Text>

              <Text style={styles.label}>Variant Name</Text>
              <TextInput
                style={styles.input}
                value={editingVariantName}
                onChangeText={setEditingVariantName}
                placeholder="e.g., Size, Temperature"
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    setShowEditVariantModal(false);
                    setEditingVariantId(null);
                  }}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingVariantId && updateVariant(editingVariantId)}
                >
                  <Text style={styles.btnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Variant Option Modals */}
        <Modal visible={showVariantOptionModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Option</Text>

              <Text style={styles.label}>Option Name</Text>
              <TextInput
                style={styles.input}
                value={optionName}
                onChangeText={setOptionName}
                placeholder="e.g., Small, Medium, Large"
                autoFocus
              />

              <Text style={styles.label}>Price Add-on ($)</Text>
              <TextInput
                style={styles.input}
                value={optionPrice}
                onChangeText={setOptionPrice}
                placeholder="0.00"
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
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={createVariantOption}
                >
                  <Text style={styles.btnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showEditVariantOptionModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Option</Text>

              <Text style={styles.label}>Option Name</Text>
              <TextInput
                style={styles.input}
                value={editingOptionName}
                onChangeText={setEditingOptionName}
                placeholder="e.g., Small, Medium, Large"
                autoFocus
              />

              <Text style={styles.label}>Price Add-on ($)</Text>
              <TextInput
                style={styles.input}
                value={editingOptionPrice}
                onChangeText={setEditingOptionPrice}
                placeholder="0.00"
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
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => editingOptionId && updateVariantOption(editingOptionId)}
                >
                  <Text style={styles.btnText}>Save</Text>
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
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    marginHorizontal: 6,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBtnActive: {
    backgroundColor: '#3b82f6',
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  categoryBtnTextActive: {
    color: '#ffffff',
  },
  categoryBtnAdd: {
    backgroundColor: '#e5e7eb',
  },
  categoryBtnAddText: {
    color: '#4b5563',
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
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemCardWrapper: {
    flex: 1,
    marginRight: 8,
    position: 'relative',
  },
  itemCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  noImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },

  // Detail Panel
  detailPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '70%',
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
});
