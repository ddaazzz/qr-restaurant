-- Migration 110: XISH wallet pass customization settings per restaurant

CREATE TABLE IF NOT EXISTS xish_wallet_settings (
  restaurant_id          INTEGER PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,

  -- Identity
  program_name           VARCHAR(100)  DEFAULT 'XISH Loyalty',
  description            VARCHAR(100)  DEFAULT 'XISH Loyalty Card',
  logo_text              VARCHAR(50)   DEFAULT 'XISH',
  organization_name      VARCHAR(100)  DEFAULT 'XISH Loyalty',

  -- Colors (CSS rgb() format)
  background_color       VARCHAR(40)   DEFAULT 'rgb(15,15,20)',
  foreground_color       VARCHAR(40)   DEFAULT 'rgb(255,255,255)',
  label_color            VARCHAR(40)   DEFAULT 'rgb(201,168,76)',

  -- Front field labels
  header_field_label     VARCHAR(50)   DEFAULT 'TIER',
  primary_field_label    VARCHAR(50)   DEFAULT 'POINTS BALANCE',
  secondary1_label       VARCHAR(50)   DEFAULT 'MEMBER',
  secondary2_label       VARCHAR(50)   DEFAULT 'XISH ID',

  -- Back of card custom fields (up to 3)
  back1_label            VARCHAR(100)  DEFAULT 'Order Online',
  back1_value            TEXT          DEFAULT '',
  back2_label            VARCHAR(100)  DEFAULT 'About XISH',
  back2_value            TEXT          DEFAULT 'Asia''s national loyalty network — xish.io',
  back3_label            VARCHAR(100)  DEFAULT '',
  back3_value            TEXT          DEFAULT '',

  -- Barcode
  barcode_format         VARCHAR(30)   DEFAULT 'PKBarcodeFormatQR',

  -- Location relevance (show on lock screen when nearby)
  location_lat           NUMERIC(10,7),
  location_lng           NUMERIC(10,7),
  location_label         VARCHAR(100),

  updated_at             TIMESTAMPTZ   DEFAULT NOW()
);
