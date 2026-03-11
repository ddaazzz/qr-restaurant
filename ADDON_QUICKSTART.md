# Addon System - Quick Start Guide

## For Restaurant Admins: Setting Up Addons in 5 Minutes

### What are Addons?
Addons let you turn regular menu items into meals/combos. For example:
- "Chicken Rice" item can have addon items like "Iced Tea", "Juice", etc. at a discounted price
- When customers order Chicken Rice, they see a modal asking if they want to add a drink
- The addon appears at a discount (e.g., regular drink is $2.50, addon drink is $1.50)

### Step 1: Create Menu Items (if not existing)
You need two types of items:
1. **Base Items** (Main dish): e.g., "Chicken Rice"
2. **Addon Items** (Drinks, Sides): e.g., "Iced Tea", "Orange Juice"

Both should already be in your menu with:
- Name ✅
- Price ✅
- Category (important!) ✅
- Available = true ✅

### Step 2: Configure Kitchen Zones (Important!)
Addons will only print to the correct kitchen if zones are configured:

**In Admin Dashboard → Printer Settings:**

1. Go to **Printer Zones** section
2. Create zones for each kitchen station:
   - Zone 1: "Grill" (for food items)
   - Zone 2: "Beverages" (for drinks)
   - etc.

3. Link categories to zones:
   - Link "Food" category → "Grill" zone
   - Link "Drinks" category → "Beverages" zone

This ensures:
- Chicken Rice prints to Grill zone ✅
- Drink addon prints to Beverages zone ✅

### Step 3: Create Addons (Two Methods)

#### Method A: Using Admin API (Recommended)
```
POST /api/restaurants/:restaurantId/addons

{
  "menu_item_id": 5,           // Chicken Rice
  "addon_item_id": 12,          // Iced Tea
  "addon_name": "Add Beverage",
  "addon_description": "Choose a drink to include",
  "regular_price_cents": 250,   // Normal drink price $2.50
  "addon_discount_price_cents": 150  // Addon price $1.50 (40% discount)
}
```

#### Method B: Using Mobile App (Coming Soon)
- Go to Menu Tab
- Select menu item
- Tap "Add Addon"
- Choose addon item and set prices

### Step 4: Test!

1. **On Customer Menu (Web):**
   - Go to QR landing page
   - Browse to item you configured addon for
   - Click "Add to Cart"
   - See addon modal appear
   - Select addon and confirm
   - Total should update with addon price

2. **In Kitchen:**
   - Main item prints to its zone
   - Addon item prints to its zone
   - Staff sees [isAddon] flag in receipt

### Real World Example

**Restaurant Scenario:**
- Your restaurant has a "Chicken Rice" dish (450¢) served by grill
- You want to offer a "beverage combo" at discount
- Iced Tea normally costs 250¢, but as addon = 150¢

**Setup:**
```bash
POST /api/restaurants/1/addons

{
  "menu_item_id": 5,
  "addon_item_id": 8,
  "addon_name": "Add Beverage",
  "addon_description": "Add any drink to make it a combo",
  "regular_price_cents": 250,
  "addon_discount_price_cents": 150
}
```

**Result:**
- Customer orders Chicken Rice: $4.50
- Adds Iced Tea addon: +$1.50
- Total: $6.00
- Kitchen sees:
  - Server 1 (Grill): Cook 1x Chicken Rice
  - Server 2 (Beverages): Pour 1x Iced Tea [addon]

---

## Common Setups

### Pizza Restaurant
```
Main Items          → Addon Items
- Margherita       → Coke, Sprite, Fanta
- Pepperoni        → Coke, Sprite, Fanta
- Vegetarian       → Coke, Sprite, Fanta

Kitchen Zones:
- Zone 1: "Oven" (Pizza category)
- Zone 2: "Beverages" (Drinks category)
```

### Chinese Restaurant
```
Main Items          → Addon Items
- Chicken Rice     → Egg Roll, Spring Roll, Soup
- Beef Noodles     → Egg Roll, Spring Roll, Soup
- Tofu Dish        → Egg Roll, Spring Roll, Soup

Kitchen Zones:
- Zone 1: "Wok" (Mains category)
- Zone 2: "Appetizers" (Sides category)
```

### Café
```
Main Items          → Addon Items
- Sandwich         → Coffee, Tea, Juice
- Salad            → Coffee, Tea, Juice
- Soup             → Coffee, Tea, Juice

Kitchen Zones:
- Zone 1: "Kitchen" (Food category)
- Zone 2: "Beverages" (Drinks category)
```

---

## FAQ

**Q: Can I have multiple addons on one item?**
A: Yes! Create multiple addon records with the same menu_item_id. Customers can select all of them.

**Q: What if I don't have kitchen zones configured?**
A: Addons will still work, but all items will print to the default printer. Zones are optional but recommended for proper order separation.

**Q: Can I change addon prices later?**
A: Yes! Use PATCH endpoint:
```
PATCH /api/restaurants/:restaurantId/addons/:addonId
{
  "addon_discount_price_cents": 200
}
```

**Q: What if customer wants multiple drinks?**
A: Each addon can be selected up to 1 quantity via modal. Admin can manually edit in kitchen if needed.

**Q: Will this work on mobile?**
A: Customers order via web (QR code). Mobile app is for staff management.

**Q: Can I disable an addon without deleting it?**
A: Yes! Use PATCH to set is_available = false

**Q: Will the addon show if item is not in cart yet?**
A: No, addon modal only shows after adding the base item to cart.

---

## Troubleshooting

**Addon modal not appearing?**
- Check addon is_available = true
- Verify menu_item_id is correct
- Ensure both items are available in menu

**Items printing to wrong zone?**
- Verify category is linked to zone
- Check print_category_id in order_items table
- Confirm printer zone has correct printer config

**Addon price not showing discount?**
- Verify addon_discount_price_cents < regular_price_cents
- Check order response includes addon pricing
- Confirm cart updates total when addon selected

**"Addon already exists" error?**
- Only one addon per combination of:
  - This restaurant
  - This menu item
  - This addon item
- Delete old addon if creating duplicate

---

## Next Steps

1. ✅ Create your addons using the POST endpoint
2. ✅ Configure kitchen zones if you have multiple stations
3. ✅ Test on customer QR menu
4. ✅ Train staff on recognizing addon items (marked with [addon] in kitchen)
5. ✅ Test kitchen printing to ensure items route correctly

---

**For API Details:** See [ADDON_SYSTEM_COMPLETE.md](./ADDON_SYSTEM_COMPLETE.md)

**Need Help?** Check the complete documentation or contact support.
