import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl, Alert, Image, Modal } from 'react-native';
import { apiClient, API_URL } from '../../services/apiClient';
import { useLanguage } from '../../contexts/LanguageContext';

interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price_cents: number;
  category_id: number;
  image_url?: string;
}

interface Variant {
  id: number;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  options: VariantOption[];
}

interface VariantOption {
  id: number;
  name: string;
  price_cents: number;
}

interface Category {
  id: number;
  name: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  variants?: SelectedVariant[];
}

interface SelectedVariant {
  variantId: number;
  variantName: string;
  optionId: number;
  optionName: string;
}

interface Order {
  id: number;
  session_id?: number;
  order_type: string;
  status: string;
  total_cents: number;
  created_at: string;
  items?: any[];
  table_id?: number;
  table_name?: string;
}

interface Session {
  session_id: number;
  table_id: number;
  table_name: string;
  pax: number;
  started_at: string;
  ended_at?: string;
}

export interface OrdersTabRef {
  toggleHistory: () => void;
}

interface OrdersTabProps {
  restaurantId: string;
  selectedTableOnInit?: any;
}

const OrdersTabComponent = (props: OrdersTabProps, ref: React.ForwardedRef<OrdersTabRef>) => {
  const { restaurantId, selectedTableOnInit } = props;
  const { t } = useLanguage();
    
    // Menu state
    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Variant modal state
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [itemVariants, setItemVariants] = useState<Variant[]>([]);
    const [variantSelections, setVariantSelections] = useState<{
      [variantId: number]: number | number[];
    }>({});
    const [showVariantModal, setShowVariantModal] = useState(false);
    
    // Cart state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orderType, setOrderType] = useState<'table' | 'pay-now' | 'to-go' | null>(null);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tables, setTables] = useState<any[]>([]);
    
    // History state
    const [showHistory, setShowHistory] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [historyFilter, setHistoryFilter] = useState<'all' | 'pay-now' | 'to-go' | 'sessions'>('all');
    const [selectedOrder, setSelectedOrder] = useState<Order | Session | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionBillData, setSessionBillData] = useState<any>(null);
    const [loadingBill, setLoadingBill] = useState(false);

    // Expose toggleHistory through ref
    useImperativeHandle(ref, () => ({
      toggleHistory() {
        setShowHistory(prev => !prev);
      }
    }), []);

    // Handle selectedTableOnInit from Tables tab
    useEffect(() => {
      if (selectedTableOnInit) {
        setOrderType('table');
        setSelectedTable(selectedTableOnInit.name);
      }
    }, [selectedTableOnInit]);

    // Load menu and tables on mount
    useEffect(() => {
      loadMenu();
      loadTables();
    }, [restaurantId]);

    // Load history when showing history view
    useEffect(() => {
      if (showHistory) {
        loadOrdersAndSessions();
      }
    }, [showHistory, historyFilter]);

    const loadMenu = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/restaurants/${restaurantId}/menu`);
        setCategories(response.data.categories || []);
        setMenuItems(response.data.items || []);
        if (response.data.categories?.length > 0) {
          setSelectedCategory(response.data.categories[0].id);
        }
      } catch (err: any) {
        console.error('Error loading menu:', err);
        setError('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };

    const loadTables = async () => {
      try {
        const response = await apiClient.get(`/api/restaurants/${restaurantId}/tables`);
        setTables(response.data || []);
      } catch (err) {
        console.error('Error loading tables:', err);
      }
    };

    const loadOrdersAndSessions = async () => {
      try {
        setRefreshing(true);
        setError(null);

        if (historyFilter === 'sessions') {
          const response = await apiClient.get(`/api/restaurants/${restaurantId}/sessions`);
          setSessions(response.data || []);
        } else {
          const response = await apiClient.get(`/api/restaurants/${restaurantId}/orders`);
          let filteredOrders = Array.isArray(response.data) ? response.data : [];

          if (historyFilter === 'pay-now') {
            filteredOrders = filteredOrders.filter(o => o.order_type === 'counter' || o.order_type === 'pay-now');
          } else if (historyFilter === 'to-go') {
            filteredOrders = filteredOrders.filter(o => o.order_type === 'to-go');
          }

          setOrders(filteredOrders);
        }
      } catch (err: any) {
        console.error('Error loading orders:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setRefreshing(false);
      }
    };

    const loadSessionBill = async (sessionId: number) => {
      try {
        setLoadingBill(true);
        const response = await apiClient.get(`/api/sessions/${sessionId}/bill`);
        setSessionBillData(response.data);
      } catch (err: any) {
        console.error('Error loading session bill:', err);
        setSessionBillData(null);
      } finally {
        setLoadingBill(false);
      }
    };

    const handleItemPress = async (item: MenuItem) => {
      try {
        setSelectedItem(item);
        setVariantSelections({});
        
        // Fetch variants for this item
        const response = await apiClient.get(`/api/menu-items/${item.id}/variants`);
        setItemVariants(response.data || []);
        setShowVariantModal(true);
      } catch (err) {
        console.error('Error loading variants:', err);
        // If no variants, just add to cart
        handleAddToCart(item, []);
      }
    };

    const handleAddToCart = (item: MenuItem, selectedVariantsList: SelectedVariant[] = []) => {
      setCart(prevCart => [...prevCart, {
        ...item,
        quantity: 1,
        variants: selectedVariantsList,
      }]);
    };

    const handleVariantSubmit = () => {
      if (!selectedItem) return;

      // Validate required variants
      for (const variant of itemVariants) {
        if (variant.required && !variantSelections[variant.id]) {
          Alert.alert('Missing Selection', `Please select ${variant.name}`);
          return;
        }
      }

      // Build selected variants list
      const selectedVariantsList: SelectedVariant[] = [];
      Object.entries(variantSelections).forEach(([variantId, optionIds]) => {
        const variant = itemVariants.find(v => v.id === parseInt(variantId));
        if (variant) {
          const optionIdArray = Array.isArray(optionIds) ? optionIds : [optionIds];
          optionIdArray.forEach(optionId => {
            const option = variant.options.find(o => o.id === optionId);
            if (option) {
              selectedVariantsList.push({
                variantId: variant.id,
                variantName: variant.name,
                optionId: option.id,
                optionName: option.name,
              });
            }
          });
        }
      });

      handleAddToCart(selectedItem, selectedVariantsList);
      setShowVariantModal(false);
    };

    const handleRemoveFromCart = (index: number) => {
      setCart(prevCart => prevCart.filter((_, i) => i !== index));
    };

    const handleUpdateQuantity = (index: number, quantity: number) => {
      if (quantity <= 0) {
        handleRemoveFromCart(index);
      } else {
        setCart(prevCart =>
          prevCart.map((item, i) => i === index ? { ...item, quantity } : item)
        );
      }
    };

    const handleSubmitOrder = async () => {
      if (cart.length === 0) {
        Alert.alert(t('orders.empty-cart'), t('orders.add-items'));
        return;
      }
      if (!orderType) {
        Alert.alert(t('error.error'), t('orders.select-type'));
        return;
      }
      if (orderType === 'table' && !selectedTable) {
        Alert.alert(t('error.error'), t('orders.select-table'));
        return;
      }

      try {
        // TODO: Implement actual API submission
        Alert.alert(t('success.success'), `${orderType} order submitted with ${cart.length} items`);
        setCart([]);
        setOrderType(null);
        setSelectedTable(null);
      } catch (err: any) {
        Alert.alert(t('error.error'), err.message || t('error.error'));
      }
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);

    const filteredMenuItems = selectedCategory
      ? menuItems.filter(item => item.category_id === selectedCategory)
      : menuItems;

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
    
    const getFullImageUrl = (imageUrl?: string) => {
      if (!imageUrl) return null;
      if (imageUrl.startsWith('http')) return imageUrl;
      return `${API_URL}${imageUrl}`;
    };
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const getOrderTypeLabel = (orderType?: string) => {
      if (!orderType) return 'Order';
      if (orderType === 'table') return '🎯 Table';
      if (orderType === 'counter' || orderType === 'pay-now') return '🛒 Order Now';
      if (orderType === 'to-go') return '🎁 To-Go';
      return 'Order';
    };

    if (loading && !showHistory) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#5a5a5a" />
        </View>
      );
    }

    // ============= HISTORY VIEW =============
    if (showHistory) {
      const displayOrders = historyFilter === 'sessions' ? [] : orders;
      const displaySessions = historyFilter === 'sessions' ? sessions : [];

      return (
        <>
          <View style={styles.container}>
          {/* Header with back button */}
          <View style={styles.historyHeader}>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Text style={styles.backButton}>← {t('modal.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.historyTitle}>{t('orders.order-history')}</Text>
          </View>

          {/* Filter buttons */}
          <View style={styles.filterBar}>
            {[
              { id: 'all', label: t('orders.all'), count: orders.length },
              { id: 'pay-now', label: t('orders.order-now'), count: orders.filter(o => o.order_type === 'counter' || o.order_type === 'pay-now').length },
              { id: 'to-go', label: 'To-Go', count: orders.filter(o => o.order_type === 'to-go').length },
              { id: 'sessions', label: t('orders.sessions'), count: sessions.length },
            ].map((filter: any) => (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterBtn, historyFilter === filter.id && styles.filterBtnActive]}
                onPress={() => setHistoryFilter(filter.id)}
              >
                <Text style={[styles.filterBtnText, historyFilter === filter.id && styles.filterBtnTextActive]}>
                  {filter.label} ({filter.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Orders or Sessions List */}
          <FlatList
            key={`history-${historyFilter}`}
            data={historyFilter === 'sessions' ? displaySessions : displayOrders}
            keyExtractor={(item: any) => (historyFilter === 'sessions' ? item.session_id : item.id).toString()}
            renderItem={({ item }) => {
              if (historyFilter === 'sessions' && item) {
                const session = item as Session;
                if (!session || !session.session_id) return null;
                const isEnded = session.ended_at ? true : false;
                return (
                  <TouchableOpacity
                    style={styles.orderCard}
                    onPress={() => {
                      setSelectedOrder(session);
                      loadSessionBill(session.session_id);
                    }}
                  >
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderId}>🪑 {session.table_name || 'Table'}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: isEnded ? '#9ca3af' : '#10b981' }]}>
                        <Text style={styles.statusText}>{isEnded ? t('orders.closed') : t('orders.active')}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderDetails}>👥 {session.pax || 0} {t('tables.pax')} • Started {formatDate(session.started_at)}</Text>
                  </TouchableOpacity>
                );
              } else {
                const order = item as Order;
                return (
                  <TouchableOpacity
                    style={styles.orderCard}
                    onPress={() => setSelectedOrder(order)}
                  >
                    <View style={styles.orderHeader}>
                      <View>
                        <Text style={styles.orderId}>Order #{order.id}</Text>
                        <Text style={styles.orderDetails}>{getOrderTypeLabel(order.order_type)}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                        <Text style={styles.statusText}>{order.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderDetails}>{formatDate(order.created_at)}</Text>
                    <Text style={styles.orderTotal}>{formatPrice(order.total_cents)}</Text>
                  </TouchableOpacity>
                );
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{historyFilter === 'sessions' ? t('kitchen.no-active-orders') : t('orders.empty-cart')}</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOrdersAndSessions} />}
            contentContainerStyle={styles.listContent}
          />

          {/* Order Details Modal */}
          <Modal
            visible={selectedOrder !== null}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              setSelectedOrder(null);
              setSessionBillData(null);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => {
                    setSelectedOrder(null);
                    setSessionBillData(null);
                  }}>
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>
                    {historyFilter === 'sessions' ? t('orders.session-details') : t('orders.order-details')}
                  </Text>
                  <View style={{ width: 24 }} />
                </View>

                {selectedOrder && (
                  <ScrollView style={styles.modalBody}>
                    {historyFilter === 'sessions' ? (
                      <SessionDetails session={selectedOrder as Session} billData={sessionBillData} />
                    ) : (
                      <OrderDetails order={selectedOrder as Order} />
                    )}
                  </ScrollView>
                )}

                <View style={styles.modalActions}>
                  {historyFilter === 'sessions' && selectedOrder ? (
                    <>
                      <TouchableOpacity 
                        style={[styles.modalActionBtn, styles.printBtn]}
                      >
                        <Text style={styles.modalActionBtnText}>🖨️ {t('orders.print-receipt')}</Text>
                      </TouchableOpacity>
                      {selectedOrder && !(selectedOrder as Session).ended_at && (
                        <TouchableOpacity style={[styles.modalActionBtn, styles.closeBtn]}>
                          <Text style={styles.modalActionBtnText}>✓ {t('tables.close-bill')}</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : selectedOrder ? (
                    <TouchableOpacity 
                      style={[styles.modalActionBtn, styles.printBtn]}
                    >
                      <Text style={styles.modalActionBtnText}>🖨️ {t('orders.print-receipt')}</Text>
                    </TouchableOpacity>
                  ) : null}
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
        </>
      );
    }

    // ============= MENU VIEW (DEFAULT) =============
    return (
      <>
        <View style={styles.container}>
          {/* Category Bar Wrapper - Separate Context */}
          <View style={styles.categoryBarWrapper}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesBar}
              contentContainerStyle={styles.categoriesContent}
            >
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    selectedCategory === cat.id && styles.categoryBtnActive
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={[
                    styles.categoryBtnText,
                    selectedCategory === cat.id && styles.categoryBtnTextActive
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Food Items Grid Wrapper - Separate Context */}
          <View style={styles.foodItemsGridWrapper}>
            <FlatList
              key={`menu-${selectedCategory}`}
              data={filteredMenuItems}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => (
              <View style={styles.menuItemContainer}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleItemPress(item)}
                >
                  {item.image_url && item.image_url.trim() ? (
                    <Image
                      source={{ uri: getFullImageUrl(item.image_url)! }}
                      style={styles.menuItemImage}
                      onError={() => console.log('Image load error for:', item.name, 'URL:', getFullImageUrl(item.image_url))}
                    />
                  ) : (
                    <View style={[styles.menuItemImage, styles.noImage]}>
                      <Text style={styles.noImageText}>📸</Text>
                    </View>
                  )}
                  <View style={styles.menuItemInfo}>
                    <Text style={styles.menuItemName} numberOfLines={1}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.menuItemDescription} numberOfLines={1}>{item.description}</Text>
                    )}
                    <View style={styles.menuItemFooter}>
                      <Text style={styles.menuItemPrice}>{formatPrice(item.price_cents)}</Text>
                      <Text style={styles.addButton}>+ Add</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.menuGrid}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMenu} />}
          />
          </View>

          {/* Bottom panel: Cart + Order type */}
          {cart.length > 0 && (
            <View style={styles.bottomPanel}>
              {/* Cart items preview */}
              <View style={styles.cartPreview}>
                {cart.slice(0, 2).map((item, idx) => (
                <View key={idx} style={styles.cartItemPreviewWithPrice}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemPreviewText} numberOfLines={1}>{item.name}</Text>
                    {item.variants && item.variants.length > 0 && (
                      <Text style={styles.cartItemVariantText} numberOfLines={1}>
                        {(item.variants as any[]).map((v: any) => v.optionName).join(', ')}
                      </Text>
                    )}
                    <Text style={styles.cartItemPriceText}>
                      {item.quantity}x {formatPrice(item.price_cents)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveFromCart(idx)}>
                    <Text style={styles.removeItemBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {cart.length > 2 && (
                <Text style={styles.cartItemCount}>+{cart.length - 2} more items</Text>
              )}
            </View>

              {/* Order type selection */}
              <View style={styles.orderTypeSection}>
                <Text style={styles.sectionLabel}>Order Type</Text>
                <View style={styles.orderTypeButtons}>
                  <TouchableOpacity
                    style={[styles.orderTypeBtn, orderType === 'table' && styles.orderTypeBtnActive]}
                    onPress={() => setOrderType('table')}
                  >
                    <Text style={[styles.orderTypeBtnText, orderType === 'table' && styles.orderTypeBtnTextActive]}>
                      🎯 Table
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.orderTypeBtn, orderType === 'pay-now' && styles.orderTypeBtnActive]}
                    onPress={() => setOrderType('pay-now')}
                  >
                    <Text style={[styles.orderTypeBtnText, orderType === 'pay-now' && styles.orderTypeBtnTextActive]}>
                      🛒 {t('orders.order-now')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.orderTypeBtn, orderType === 'to-go' && styles.orderTypeBtnActive]}
                    onPress={() => setOrderType('to-go')}
                  >
                    <Text style={[styles.orderTypeBtnText, orderType === 'to-go' && styles.orderTypeBtnTextActive]}>
                      🎁 To-Go
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Table selection for table orders */}
              {orderType === 'table' && (
                <View style={styles.tableSelectionSection}>
                  <Text style={styles.sectionLabel}>{t('orders.select-table')}</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.tableList}
                  >
                    {tables.map(table => (
                      <TouchableOpacity
                        key={table.id}
                        style={[
                          styles.tableBtn,
                          selectedTable === table.id.toString() && styles.tableBtnActive
                        ]}
                        onPress={() => setSelectedTable(table.id.toString())}
                      >
                        <Text style={[
                          styles.tableBtnText,
                          selectedTable === table.id.toString() && styles.tableBtnTextActive
                        ]}>
                          {table.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Cart total and submit */}
              <View style={styles.cartFooter}>
                <View>
                  <Text style={styles.cartTotalLabel}>{cart.length} items</Text>
                </View>
                <Text style={styles.cartTotalPrice}>{formatPrice(cartTotal)}</Text>
                <TouchableOpacity 
                  style={[
                    styles.submitBtn,
                    (!orderType || (orderType === 'table' && !selectedTable)) && styles.submitBtnDisabled
                  ]}
                  disabled={!orderType || (orderType === 'table' && !selectedTable)}
                  onPress={handleSubmitOrder}
                >
                  <Text style={styles.submitBtnText}>✓ {t('button.submit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Variant Modal */}
        <Modal
          visible={showVariantModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowVariantModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.variantModalContent}>
              <View style={styles.variantModalHeader}>
                <TouchableOpacity onPress={() => setShowVariantModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.variantModalTitle}>{selectedItem?.name}</Text>
                <View style={{ width: 24 }} />
              </View>

              {selectedItem?.image_url && selectedItem.image_url.trim() && (
                <Image
                  source={{ uri: getFullImageUrl(selectedItem.image_url)! }}
                  style={styles.variantImage}
                  onError={() => console.log('Variant modal image error for:', selectedItem.name, 'URL:', getFullImageUrl(selectedItem.image_url))}
                />
              )}

              {/* Item info: description and price */}
              <View style={styles.itemInfoBanner}>
                {selectedItem?.description && (
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    {selectedItem.description}
                  </Text>
                )}
                {selectedItem && (
                  <Text style={styles.itemPrice}>
                    {formatPrice(selectedItem.price_cents || 0)}
                  </Text>
                )}
              </View>

              <ScrollView style={styles.variantContent}>
                {itemVariants.length > 0 ? (
                  itemVariants.map((variant) => (
                    <View key={variant.id} style={styles.variantGroup}>
                      <View style={styles.variantGroupHeader}>
                        <Text style={styles.variantGroupName}>{variant.name}</Text>
                        {variant.required && <Text style={styles.requiredBadge}>Required</Text>}
                      </View>

                      {variant.min_select === 1 && variant.max_select === 1 ? (
                        // Radio buttons for single selection
                        variant.options.map((option) => (
                          <TouchableOpacity
                            key={option.id}
                            style={styles.variantOption}
                            onPress={() => {
                              setVariantSelections(prev => ({
                                ...prev,
                                [variant.id]: option.id,
                              }));
                            }}
                          >
                            <View
                              style={[
                                styles.radioButton,
                                variantSelections[variant.id] === option.id && styles.radioButtonSelected,
                              ]}
                            />
                            <View style={styles.variantOptionContent}>
                              <Text style={styles.variantOptionName}>{option.name}</Text>
                              {option.price_cents > 0 && (
                                <Text style={styles.variantOptionPrice}>+{formatPrice(option.price_cents)}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))
                      ) : (
                        // Checkboxes for multiple selections
                        variant.options.map((option) => {
                          const selected = Array.isArray(variantSelections[variant.id])
                            ? (variantSelections[variant.id] as number[]).includes(option.id)
                            : false;
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={styles.variantOption}
                              onPress={() => {
                                setVariantSelections(prev => {
                                  const current = Array.isArray(prev[variant.id]) ? [...(prev[variant.id] as number[])] : [];
                                  if (current.includes(option.id)) {
                                    current.splice(current.indexOf(option.id), 1);
                                  } else {
                                    current.push(option.id);
                                  }
                                  return {
                                    ...prev,
                                    [variant.id]: current,
                                  };
                                });
                              }}
                            >
                              <View
                                style={[
                                  styles.checkbox,
                                  selected && styles.checkboxSelected,
                                ]}
                              />
                              <View style={styles.variantOptionContent}>
                                <Text style={styles.variantOptionName}>{option.name}</Text>
                                {option.price_cents > 0 && (
                                  <Text style={styles.variantOptionPrice}>+{formatPrice(option.price_cents)}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  ))
                ) : null}
              </ScrollView>

              <View style={styles.variantModalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowVariantModal(false)}
                >
                  <Text style={styles.cancelBtnText}>{t('button.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={handleVariantSubmit}
                >
                  <Text style={styles.addBtnText}>{t('menu.add-item')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
};

export const OrdersTab = React.forwardRef(OrdersTabComponent) as React.ForwardRefExoticComponent<
  OrdersTabProps & React.RefAttributes<OrdersTabRef>
>;

// Helper component for session details
const SessionDetails = ({ session, billData }: { session: Session | null; billData?: any }) => {
  if (!session) return null;
  
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const isEnded = session.ended_at ? true : false;
  
  return (
    <View style={styles.detailsContainer}>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>{t('orders.table')}</Text>
        <Text style={styles.detailValue}>{session.table_name || 'N/A'}</Text>
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>{t('tables.pax')}</Text>
        <Text style={styles.detailValue}>👥 {session.pax || 0} people</Text>
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>{t('tables.start-session')}</Text>
        <Text style={styles.detailValue}>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</Text>
      </View>
      {session.ended_at && (
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>{t('orders.closed')}</Text>
          <Text style={styles.detailValue}>{new Date(session.ended_at).toLocaleString()}</Text>
        </View>
      )}
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>{t('bookings.status')}</Text>
        <Text style={[styles.detailValue, { color: isEnded ? '#9ca3af' : '#10b981' }]}>
          {isEnded ? t('orders.closed') : t('orders.active')}
        </Text>
      </View>
      
      {/* Bill Items and Total */}
      {billData ? (
        <>
          {billData.items && billData.items.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Items ({billData.items.length})</Text>
              {billData.items.map((item: any, idx: number) => (
                <Text key={idx} style={styles.itemListText}>
                  • {item.name || item.item_name} x{item.quantity} - {formatPrice((item.price_cents || item.unit_price_cents) * item.quantity)}
                </Text>
              ))}
            </View>
          )}
          
          {billData.subtotal_cents !== undefined && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Subtotal</Text>
              <Text style={styles.detailValue}>{formatPrice(billData.subtotal_cents)}</Text>
            </View>
          )}
          
          {billData.service_charge_cents !== undefined && billData.service_charge_cents > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Service Charge</Text>
              <Text style={styles.detailValue}>{formatPrice(billData.service_charge_cents)}</Text>
            </View>
          )}
          
          {billData.total_cents !== undefined && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Total</Text>
              <Text style={[styles.detailValue, { fontSize: 18, fontWeight: 'bold', color: '#10b981' }]}>
                {formatPrice(billData.total_cents)}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
};

// Helper component for order details
const OrderDetails = ({ order }: { order: Order | null }) => {
  if (!order) return null;
  
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const getOrderTypeLabel = (orderType?: string) => {
    if (!orderType) return 'Order';
    if (orderType === 'table') return '🎯 Table';
    if (orderType === 'counter' || orderType === 'pay-now') return '🛒 Order Now';
    if (orderType === 'to-go') return '🎁 To-Go';
    return 'Order';
  };

  return (
    <View style={styles.detailsContainer}>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Order ID</Text>
        <Text style={styles.detailValue}>#{order.id}</Text>
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>{t('orders.select-type')}</Text>
        <Text style={styles.detailValue}>{getOrderTypeLabel(order.order_type)}</Text>
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>{t('bookings.status')}</Text>
        <Text style={[styles.detailValue, { color: getStatusColor(order.status) }]}>{order.status}</Text>
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Total</Text>
        <Text style={[styles.detailValue, { fontSize: 18, fontWeight: 'bold', color: '#10b981' }]}>
          {formatPrice(order.total_cents)}
        </Text>
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Created Date</Text>
        <Text style={styles.detailValue}>{new Date(order.created_at).toLocaleString()}</Text>
      </View>
      {order.items && order.items.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Items ({order.items.length})</Text>
          {order.items.map((item, idx) => (
            <Text key={idx} style={styles.itemListText}>
              • {item.name} x{item.quantity} - {formatPrice(item.price_cents * item.quantity)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return '#10b981';
    case 'pending': return '#f59e0b';
    case 'rejected': return '#ef4444';
    default: return '#6b7280';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Orders header with navigation
  ordersHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ordersHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  historyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2C3E50',
    borderRadius: 6,
    borderWidth: 0,
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  
  // History view
  historyHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  filterBtnActive: {
    backgroundColor: '#2C3E50',
  },
  filterBtnText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  filterBtnTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
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

  // Menu view
  categoryBarWrapper: {
    flex: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  foodItemsGridWrapper: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  categoriesBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    height: 48,
    flexShrink: 0,
  },
  categoriesContent: {
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

  // Menu grid
  menuGrid: {
    padding: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  menuItemContainer: {
    flex: 1,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  menuItemImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 32,
  },
  menuItemInfo: {
    padding: 10,
  },
  menuItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 3,
  },
  menuItemDescription: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  menuItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
  },
  addButton: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5a5a5a',
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    paddingBottom: 20,
  },
  cartPreview: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cartItemPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  cartItemPreviewText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  removeItemBtn: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  cartItemCount: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  cartItemPreviewWithPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    marginBottom: 6,
  },
  cartItemVariantText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginVertical: 2,
  },
  cartItemPriceText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },

  // Order type
  orderTypeSection: {
    marginBottom: 12,
  },
  orderTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  orderTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderTypeBtnActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  orderTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  orderTypeBtnTextActive: {
    color: '#fff',
  },

  // Table selection
  tableSelectionSection: {
    marginBottom: 12,
  },
  tableList: {
    marginBottom: 8,
  },
  tableBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableBtnActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  tableBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tableBtnTextActive: {
    color: '#fff',
  },

  // Cart footer
  cartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  cartTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  cartTotalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
    minWidth: 60,
    textAlign: 'right',
  },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalBody: {
    padding: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  printBtn: {
    backgroundColor: '#5a5a5a',
  },
  closeBtn: {
    backgroundColor: '#10b981',
  },
  modalActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Variant modal styling
  variantModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    paddingTop: 0,
  },
  variantModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  variantModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  variantImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  itemInfoBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    lineHeight: 18,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  variantContent: {
    padding: 16,
    maxHeight: '50%',
  },
  variantGroup: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  variantGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  variantGroupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  requiredBadge: {
    backgroundColor: '#ef4444',
    color: '#fff',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  variantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#5a5a5a',
    marginRight: 12,
  },
  radioButtonSelected: {
    backgroundColor: '#5a5a5a',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#5a5a5a',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#5a5a5a',
  },
  variantOptionContent: {
    flex: 1,
  },
  variantOptionName: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 2,
  },
  variantOptionPrice: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  variantModalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  addBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Details styling
  detailsContainer: {
    paddingBottom: 12,
  },
  detailSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  itemListText: {
    fontSize: 13,
    color: '#666',
    marginVertical: 2,
  },
});
