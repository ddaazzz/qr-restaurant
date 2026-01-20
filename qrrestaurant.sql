--
-- PostgreSQL database dump
--

\restrict HXgXAM3GftjdmYJgUJV9QQ0lzSP5eleBT5aMl7fKfbuX4hpbWMBvMzq63e2H3OI

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-01-20 12:12:20

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 5067 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 227 (class 1259 OID 16490)
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_categories (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0,
    icon text
);


ALTER TABLE public.menu_categories OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16489)
-- Name: menu_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_categories_id_seq OWNER TO postgres;

--
-- TOC entry 5068 (class 0 OID 0)
-- Dependencies: 226
-- Name: menu_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_categories_id_seq OWNED BY public.menu_categories.id;


--
-- TOC entry 237 (class 1259 OID 16700)
-- Name: menu_item_variant_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_item_variant_options (
    id integer NOT NULL,
    variant_id integer,
    name text NOT NULL,
    price_cents integer DEFAULT 0,
    is_available boolean DEFAULT true
);


ALTER TABLE public.menu_item_variant_options OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 16699)
-- Name: menu_item_variant_options_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_item_variant_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_item_variant_options_id_seq OWNER TO postgres;

--
-- TOC entry 5069 (class 0 OID 0)
-- Dependencies: 236
-- Name: menu_item_variant_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_item_variant_options_id_seq OWNED BY public.menu_item_variant_options.id;


--
-- TOC entry 235 (class 1259 OID 16682)
-- Name: menu_item_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_item_variants (
    id integer NOT NULL,
    menu_item_id integer,
    name text NOT NULL,
    required boolean DEFAULT false,
    min_select integer,
    max_select integer,
    CONSTRAINT variant_selection_rule CHECK ((((min_select IS NULL) OR (min_select >= 0)) AND ((max_select IS NULL) OR (max_select >= min_select))))
);


ALTER TABLE public.menu_item_variants OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 16681)
-- Name: menu_item_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_item_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_item_variants_id_seq OWNER TO postgres;

--
-- TOC entry 5070 (class 0 OID 0)
-- Dependencies: 234
-- Name: menu_item_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_item_variants_id_seq OWNED BY public.menu_item_variants.id;


--
-- TOC entry 229 (class 1259 OID 16508)
-- Name: menu_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    category_id integer NOT NULL,
    name text NOT NULL,
    price_cents integer NOT NULL,
    description text,
    available boolean DEFAULT true,
    image_url text
);


ALTER TABLE public.menu_items OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16507)
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_items_id_seq OWNER TO postgres;

--
-- TOC entry 5071 (class 0 OID 0)
-- Dependencies: 228
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- TOC entry 239 (class 1259 OID 16717)
-- Name: order_item_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_item_variants (
    id integer NOT NULL,
    order_item_id integer,
    variant_option_id integer
);


ALTER TABLE public.order_item_variants OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 16716)
-- Name: order_item_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_item_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_item_variants_id_seq OWNER TO postgres;

--
-- TOC entry 5072 (class 0 OID 0)
-- Dependencies: 238
-- Name: order_item_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_item_variants_id_seq OWNED BY public.order_item_variants.id;


--
-- TOC entry 233 (class 1259 OID 16545)
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    quantity integer NOT NULL,
    price_cents integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    removed boolean DEFAULT false
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16544)
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO postgres;

--
-- TOC entry 5073 (class 0 OID 0)
-- Dependencies: 232
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- TOC entry 231 (class 1259 OID 16527)
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    session_id integer NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16526)
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- TOC entry 5074 (class 0 OID 0)
-- Dependencies: 230
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- TOC entry 221 (class 1259 OID 16390)
-- Name: restaurants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.restaurants (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    theme_color text DEFAULT '#f97316'::text,
    logo_url text
);


ALTER TABLE public.restaurants OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16389)
-- Name: restaurants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.restaurants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.restaurants_id_seq OWNER TO postgres;

--
-- TOC entry 5075 (class 0 OID 0)
-- Dependencies: 220
-- Name: restaurants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.restaurants_id_seq OWNED BY public.restaurants.id;


--
-- TOC entry 225 (class 1259 OID 16461)
-- Name: table_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.table_sessions (
    id integer NOT NULL,
    table_id integer NOT NULL,
    started_at timestamp without time zone DEFAULT now(),
    ended_at timestamp without time zone
);


ALTER TABLE public.table_sessions OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16460)
-- Name: table_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.table_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.table_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5076 (class 0 OID 0)
-- Dependencies: 224
-- Name: table_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.table_sessions_id_seq OWNED BY public.table_sessions.id;


--
-- TOC entry 223 (class 1259 OID 16403)
-- Name: tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tables (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    qr_token text
);


ALTER TABLE public.tables OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16402)
-- Name: tables_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tables_id_seq OWNER TO postgres;

--
-- TOC entry 5077 (class 0 OID 0)
-- Dependencies: 222
-- Name: tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tables_id_seq OWNED BY public.tables.id;


--
-- TOC entry 4845 (class 2604 OID 16493)
-- Name: menu_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_categories_id_seq'::regclass);


--
-- TOC entry 4857 (class 2604 OID 16703)
-- Name: menu_item_variant_options id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variant_options ALTER COLUMN id SET DEFAULT nextval('public.menu_item_variant_options_id_seq'::regclass);


--
-- TOC entry 4855 (class 2604 OID 16685)
-- Name: menu_item_variants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variants ALTER COLUMN id SET DEFAULT nextval('public.menu_item_variants_id_seq'::regclass);


--
-- TOC entry 4847 (class 2604 OID 16511)
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- TOC entry 4860 (class 2604 OID 16720)
-- Name: order_item_variants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item_variants ALTER COLUMN id SET DEFAULT nextval('public.order_item_variants_id_seq'::regclass);


--
-- TOC entry 4852 (class 2604 OID 16548)
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- TOC entry 4849 (class 2604 OID 16530)
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- TOC entry 4838 (class 2604 OID 16393)
-- Name: restaurants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants ALTER COLUMN id SET DEFAULT nextval('public.restaurants_id_seq'::regclass);


--
-- TOC entry 4843 (class 2604 OID 16464)
-- Name: table_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_sessions ALTER COLUMN id SET DEFAULT nextval('public.table_sessions_id_seq'::regclass);


--
-- TOC entry 4841 (class 2604 OID 16406)
-- Name: tables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables ALTER COLUMN id SET DEFAULT nextval('public.tables_id_seq'::regclass);


--
-- TOC entry 5049 (class 0 OID 16490)
-- Dependencies: 227
-- Data for Name: menu_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_categories (id, restaurant_id, name, sort_order, icon) FROM stdin;
1	1	Food	1	\N
2	1	Drinks	2	\N
\.


--
-- TOC entry 5059 (class 0 OID 16700)
-- Dependencies: 237
-- Data for Name: menu_item_variant_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_item_variant_options (id, variant_id, name, price_cents, is_available) FROM stdin;
1	1	Not Spicy	0	t
2	1	Mild	0	t
3	1	Medium	0	t
6	2	Mild	0	t
7	2	Medium	0	t
12	4	Normal Rice	0	t
15	5	No Ice	0	t
16	5	Less Ice	0	t
17	5	Normal Ice	0	t
18	5	Extra Ice	0	t
14	4	More Rice	100	t
13	4	Less Rice	0	t
5	2	Not Spicy	0	t
8	2	Extra Spicy	0	t
20	1	Extra Spicy	0	t
11	3	More Rice	100	t
9	3	Normal Rice	0	t
\.


--
-- TOC entry 5057 (class 0 OID 16682)
-- Dependencies: 235
-- Data for Name: menu_item_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_item_variants (id, menu_item_id, name, required, min_select, max_select) FROM stdin;
5	3	Ice Level	t	1	1
1	1	Spicy Level	t	1	1
2	2	Spicy Level	t	1	1
4	2	Rice Portion	t	\N	1
3	1	Rice Portion	t	1	3
\.


--
-- TOC entry 5051 (class 0 OID 16508)
-- Dependencies: 229
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_items (id, category_id, name, price_cents, description, available, image_url) FROM stdin;
1	1	Nasi Lemak	500	\N	t	/uploads/menu/373b1186b4ca17c4fa9c6cd7a7e8ff21.jfif
2	1	Fried Rice	600	\N	t	/uploads/menu/c1bc6a6b80ec1f1483da7f07e60b06eb.jpg
3	2	Iced Lemon Tea	1500	\N	t	/uploads/menu/48bf74dd9c279f66e06c3f82fcb0798a.webp
\.


--
-- TOC entry 5061 (class 0 OID 16717)
-- Dependencies: 239
-- Data for Name: order_item_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_item_variants (id, order_item_id, variant_option_id) FROM stdin;
1	49	1
3	50	16
6	52	17
7	53	7
8	53	14
9	54	3
12	55	11
14	56	11
15	57	3
17	58	1
18	58	9
19	59	1
20	59	9
30	65	15
31	66	5
32	66	12
33	67	1
34	67	9
35	68	5
36	68	5
37	68	7
38	68	8
39	68	6
40	68	12
41	68	12
42	68	13
43	68	14
44	69	8
45	69	12
46	70	6
47	70	12
48	71	6
49	71	12
50	72	6
51	72	13
52	73	6
53	73	13
57	76	1
58	76	11
59	77	1
60	77	11
61	78	1
62	78	11
63	79	6
64	79	12
65	80	6
66	80	12
67	81	6
68	81	12
69	82	6
70	82	12
71	83	1
72	83	11
73	84	18
74	85	15
75	86	6
76	86	12
77	87	15
78	88	6
79	88	12
80	89	6
81	89	12
82	90	6
83	90	12
84	91	15
85	92	6
86	92	12
87	93	1
88	93	11
89	94	6
90	94	12
91	95	6
92	95	12
93	96	1
94	96	11
\.


--
-- TOC entry 5055 (class 0 OID 16545)
-- Dependencies: 233
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, menu_item_id, quantity, price_cents, status, removed) FROM stdin;
87	53	3	5	1500	served	f
56	28	1	1	600	served	f
54	26	1	1	500	served	f
53	26	2	1	700	served	f
52	26	3	1	1500	served	t
50	25	3	1	1500	served	f
49	25	1	1	500	served	f
88	54	2	1	600	served	f
48	24	2	1	600	served	f
47	24	1	1	500	served	f
89	55	2	1	600	served	f
46	23	2	1	600	served	f
45	23	1	1	500	served	f
55	27	1	2	600	served	f
90	56	2	1	600	served	f
34	19	1	1	500	served	f
33	18	3	1	1500	served	f
91	57	3	1	1500	served	f
32	18	2	1	600	served	f
31	18	1	1	500	served	f
59	31	1	1	500	served	f
37	20	1	1	500	served	f
36	19	3	1	1500	served	f
35	19	2	1	600	served	f
65	35	3	1	1500	served	f
38	20	2	1	600	served	f
92	58	2	1	600	served	f
39	20	3	1	1500	served	f
66	35	2	1	600	served	f
40	21	1	1	500	served	f
41	21	2	1	600	served	f
67	35	1	1	500	served	f
42	22	1	1	500	served	f
43	22	2	1	600	served	f
68	36	2	1	700	served	f
44	22	3	1	1500	served	f
58	30	1	1	500	served	f
57	29	1	1	500	served	f
93	59	1	1	600	pending	f
69	37	2	1	600	served	f
94	60	2	1	600	pending	f
95	61	2	1	600	pending	f
96	62	1	1	600	pending	f
70	38	2	1	600	served	f
71	39	2	1	600	served	f
72	40	2	1	600	served	f
73	41	2	1	600	served	f
76	44	1	1	600	served	f
77	45	1	1	600	served	f
78	46	1	1	600	served	f
79	47	2	1	600	served	f
80	48	2	1	600	served	f
81	49	2	1	600	served	f
82	50	2	1	600	served	f
83	50	1	1	600	served	f
84	50	3	1	1500	served	f
85	51	3	1	1500	served	f
86	52	2	1	600	served	f
\.


--
-- TOC entry 5053 (class 0 OID 16527)
-- Dependencies: 231
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, session_id, status, created_at) FROM stdin;
18	25	served	2026-01-10 17:45:38.13774
44	44	served	2026-01-18 18:02:06.469064
45	44	served	2026-01-18 18:28:19.326752
46	44	served	2026-01-18 19:01:02.570282
47	44	served	2026-01-19 13:00:16.49332
48	44	served	2026-01-19 13:00:47.431419
49	44	served	2026-01-19 13:11:01.419093
50	44	served	2026-01-19 13:15:21.972966
51	44	served	2026-01-19 13:17:08.527753
52	44	served	2026-01-19 16:21:47.756754
19	26	served	2026-01-10 17:48:35.90013
20	26	served	2026-01-10 17:51:03.833023
21	26	served	2026-01-10 17:51:18.906434
53	44	served	2026-01-19 16:25:46.339597
54	44	served	2026-01-19 16:46:45.742722
22	27	served	2026-01-10 18:38:19.730196
23	30	served	2026-01-10 18:48:59.270373
24	30	served	2026-01-10 18:50:14.167603
55	45	served	2026-01-19 17:15:39.426824
56	45	served	2026-01-19 17:41:56.579393
25	31	served	2026-01-12 22:29:11.742634
26	31	served	2026-01-12 22:29:44.469834
27	31	served	2026-01-13 17:11:52.104588
28	31	served	2026-01-14 19:44:01.527402
57	45	served	2026-01-19 17:42:18.149799
58	45	served	2026-01-19 17:49:20.199119
59	45	served	2026-01-19 18:05:46.821845
60	46	pending	2026-01-19 18:10:31.832805
61	46	pending	2026-01-19 18:30:27.60554
62	46	pending	2026-01-19 20:39:27.33931
29	33	served	2026-01-14 19:46:08.852095
30	38	served	2026-01-15 12:50:03.266018
31	38	served	2026-01-15 12:50:32.524597
35	39	served	2026-01-15 13:35:12.422433
36	39	served	2026-01-16 21:13:27.175636
37	40	served	2026-01-16 22:04:41.166112
38	42	served	2026-01-17 16:51:08.039966
39	42	served	2026-01-17 17:14:07.105486
40	42	served	2026-01-17 17:29:36.35245
41	43	pending	2026-01-17 17:45:58.469683
\.


--
-- TOC entry 5043 (class 0 OID 16390)
-- Dependencies: 221
-- Data for Name: restaurants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.restaurants (id, name, created_at, theme_color, logo_url) FROM stdin;
1	Demo Restaurant	2026-01-07 01:51:57.871287	#f97316	\N
\.


--
-- TOC entry 5047 (class 0 OID 16461)
-- Dependencies: 225
-- Data for Name: table_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.table_sessions (id, table_id, started_at, ended_at) FROM stdin;
39	2	2026-01-15 13:09:47.03971	2026-01-16 22:04:30.476279
40	2	2026-01-16 22:04:33.477423	2026-01-16 22:04:52.786053
41	2	2026-01-16 22:05:03.506305	2026-01-16 22:05:15.326453
42	4	2026-01-16 22:31:25.673896	2026-01-17 17:45:49.720562
43	4	2026-01-17 17:45:51.985201	\N
44	2	2026-01-18 17:00:52.118878	2026-01-19 16:59:44.738701
45	2	2026-01-19 16:59:47.874689	2026-01-19 18:09:53.890857
46	2	2026-01-19 18:09:55.398858	\N
15	1	2026-01-10 15:42:17.653141	2026-01-10 16:40:02.288286
16	2	2026-01-10 15:42:18.143605	2026-01-10 16:40:02.682864
17	3	2026-01-10 15:42:18.872595	2026-01-10 16:40:03.047761
18	4	2026-01-10 15:42:19.375083	2026-01-10 16:40:03.418235
24	1	2026-01-10 17:42:25.586858	2026-01-10 17:43:00.522199
25	1	2026-01-10 17:43:10.197216	2026-01-10 17:48:05.796335
26	1	2026-01-10 17:48:24.528207	2026-01-10 18:31:42.748843
27	1	2026-01-10 18:31:50.738671	2026-01-10 18:40:09.512164
28	1	2026-01-10 18:40:17.2885	2026-01-10 18:40:20.659395
30	2	2026-01-10 18:48:20.726997	2026-01-12 22:01:43.918375
23	4	2026-01-10 17:25:28.136461	2026-01-14 19:44:42.563887
31	2	2026-01-12 22:01:45.809649	2026-01-14 19:44:44.76609
29	1	2026-01-10 18:40:44.446402	2026-01-14 19:44:46.322384
33	2	2026-01-14 19:44:56.97008	2026-01-15 12:49:41.906253
34	3	2026-01-14 19:44:57.982907	2026-01-15 12:49:43.202361
32	1	2026-01-14 19:44:55.737626	2026-01-15 12:49:44.206241
35	4	2026-01-14 19:44:58.835094	2026-01-15 12:49:46.129919
38	2	2026-01-15 12:49:56.740254	2026-01-15 13:09:39.852377
\.


--
-- TOC entry 5045 (class 0 OID 16403)
-- Dependencies: 223
-- Data for Name: tables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tables (id, restaurant_id, name, created_at, qr_token) FROM stdin;
2	1	Table 2	2026-01-07 02:11:26.842292	9023db7970fd6638d32472d693263be1
3	1	Table 3	2026-01-07 02:11:26.842292	37c3288c2e15fae756b81c23bcc505a9
4	1	Table 4	2026-01-10 12:36:28.245977	bb5d064c28ed5ca1d99a6460941b20ef
1	1	Table 1	2026-01-07 02:11:26.842292	2b9497b1ceb894499fbdf7ec393a35f8
\.


--
-- TOC entry 5078 (class 0 OID 0)
-- Dependencies: 226
-- Name: menu_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_categories_id_seq', 2, true);


--
-- TOC entry 5079 (class 0 OID 0)
-- Dependencies: 236
-- Name: menu_item_variant_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_item_variant_options_id_seq', 20, true);


--
-- TOC entry 5080 (class 0 OID 0)
-- Dependencies: 234
-- Name: menu_item_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_item_variants_id_seq', 8, true);


--
-- TOC entry 5081 (class 0 OID 0)
-- Dependencies: 228
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 9, true);


--
-- TOC entry 5082 (class 0 OID 0)
-- Dependencies: 238
-- Name: order_item_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_item_variants_id_seq', 94, true);


--
-- TOC entry 5083 (class 0 OID 0)
-- Dependencies: 232
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 96, true);


--
-- TOC entry 5084 (class 0 OID 0)
-- Dependencies: 230
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 62, true);


--
-- TOC entry 5085 (class 0 OID 0)
-- Dependencies: 220
-- Name: restaurants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.restaurants_id_seq', 1, true);


--
-- TOC entry 5086 (class 0 OID 0)
-- Dependencies: 224
-- Name: table_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.table_sessions_id_seq', 46, true);


--
-- TOC entry 5087 (class 0 OID 0)
-- Dependencies: 222
-- Name: tables_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tables_id_seq', 11, true);


--
-- TOC entry 4871 (class 2606 OID 16501)
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4881 (class 2606 OID 16710)
-- Name: menu_item_variant_options menu_item_variant_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variant_options
    ADD CONSTRAINT menu_item_variant_options_pkey PRIMARY KEY (id);


--
-- TOC entry 4879 (class 2606 OID 16693)
-- Name: menu_item_variants menu_item_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variants
    ADD CONSTRAINT menu_item_variants_pkey PRIMARY KEY (id);


--
-- TOC entry 4873 (class 2606 OID 16520)
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4883 (class 2606 OID 16723)
-- Name: order_item_variants order_item_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item_variants
    ADD CONSTRAINT order_item_variants_pkey PRIMARY KEY (id);


--
-- TOC entry 4877 (class 2606 OID 16555)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4875 (class 2606 OID 16538)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 4863 (class 2606 OID 16400)
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- TOC entry 4869 (class 2606 OID 16469)
-- Name: table_sessions table_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4865 (class 2606 OID 16414)
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- TOC entry 4867 (class 2606 OID 16421)
-- Name: tables tables_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_qr_token_key UNIQUE (qr_token);


--
-- TOC entry 4886 (class 2606 OID 16502)
-- Name: menu_categories menu_categories_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- TOC entry 4892 (class 2606 OID 16711)
-- Name: menu_item_variant_options menu_item_variant_options_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variant_options
    ADD CONSTRAINT menu_item_variant_options_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.menu_item_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4891 (class 2606 OID 16694)
-- Name: menu_item_variants menu_item_variants_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_item_variants
    ADD CONSTRAINT menu_item_variants_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- TOC entry 4887 (class 2606 OID 16521)
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE CASCADE;


--
-- TOC entry 4893 (class 2606 OID 16724)
-- Name: order_item_variants order_item_variants_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item_variants
    ADD CONSTRAINT order_item_variants_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- TOC entry 4894 (class 2606 OID 16729)
-- Name: order_item_variants order_item_variants_variant_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item_variants
    ADD CONSTRAINT order_item_variants_variant_option_id_fkey FOREIGN KEY (variant_option_id) REFERENCES public.menu_item_variant_options(id) ON DELETE CASCADE;


--
-- TOC entry 4889 (class 2606 OID 16561)
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- TOC entry 4890 (class 2606 OID 16556)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 4888 (class 2606 OID 16539)
-- Name: orders orders_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.table_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 4885 (class 2606 OID 16470)
-- Name: table_sessions table_sessions_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- TOC entry 4884 (class 2606 OID 16415)
-- Name: tables tables_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


-- Completed on 2026-01-20 12:12:20

--
-- PostgreSQL database dump complete
--

\unrestrict HXgXAM3GftjdmYJgUJV9QQ0lzSP5eleBT5aMl7fKfbuX4hpbWMBvMzq63e2H3OI

