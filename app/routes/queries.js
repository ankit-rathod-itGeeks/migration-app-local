export const queries = {
    product:`WITH tag_agg AS (
    SELECT
        m.content_item_id,
        GROUP_CONCAT(DISTINCT t.title ORDER BY t.title SEPARATOR ', ') AS tags
    FROM h9uxp_contentitem_tag_map m
    INNER JOIN h9uxp_tags t
        ON t.id = m.tag_id
    GROUP BY m.content_item_id
),
base AS (
    SELECT
        /* =========================
           PRODUCT CORE (j2store_products)
        ========================= */
        p.j2store_product_id                         AS product_id,
        p.visibility,
        p.product_source,
        p.product_source_id,
        p.product_type,
        p.main_tag,
        p.taxprofile_id,
        p.manufacturer_id,
        p.vendor_id,
        p.has_options,
        p.addtocart_text,
        p.enabled,
        REPLACE(REPLACE(REPLACE(p.plugins, CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS plugins,
        REPLACE(REPLACE(REPLACE(p.params,  CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS product_params,
        p.created_on,
        p.created_by,
        p.modified_on,
        p.modified_by,
        p.up_sells,
        p.cross_sells,
        p.productfilter_ids,

        /* =========================
           CONTENT (h9uxp_content) - linked by product_source_id
        ========================= */
        c.id                                         AS content_id,
        c.title                                      AS content_title,
        c.alias                                      AS content_alias,
        REPLACE(REPLACE(REPLACE(c.introtext, CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_introtext,
        REPLACE(REPLACE(REPLACE(c.fulltext,  CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_fulltext,
        c.state                                      AS content_state,
        c.catid                                      AS content_catid,
        c.created                                    AS content_created,
        c.created_by                                 AS content_created_by,
        c.modified                                   AS content_modified,
        c.modified_by                                AS content_modified_by,
        c.publish_up                                 AS content_publish_up,
        c.publish_down                               AS content_publish_down,
        REPLACE(REPLACE(REPLACE(c.images,    CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_images_json,
        REPLACE(REPLACE(REPLACE(c.urls,      CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_urls_json,
        REPLACE(REPLACE(REPLACE(c.attribs,   CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_attribs,
        c.version                                    AS content_version,
        c.ordering                                   AS content_ordering,
        REPLACE(REPLACE(REPLACE(c.metakey,   CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_metakey,
        REPLACE(REPLACE(REPLACE(c.metadesc,  CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_metadesc,
        c.access                                     AS content_access,
        c.hits                                       AS content_hits,
        REPLACE(REPLACE(REPLACE(c.metadata,  CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS content_metadata,
        c.featured                                   AS content_featured,
        c.language                                   AS content_language,
        c.note                                       AS content_note,

        /* =========================
           CATEGORY (h9uxp_categories) via content.catid (TITLE ONLY)
        ========================= */
        cat.title                                    AS categoryId,

        /* =========================
           TAGS (Comma separated from tag_map + tags)
        ========================= */
        ta.tags                                      AS tags,

        /* =========================
           IMAGES (j2store_productimages)
        ========================= */
        img.j2store_productimage_id,
        img.main_image,
        img.main_image_alt,
        img.thumb_image,
        img.thumb_image_alt,
        REPLACE(REPLACE(REPLACE(img.additional_images,     CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS additional_images,
        REPLACE(REPLACE(REPLACE(img.additional_images_alt, CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS additional_images_alt,

        /* =========================
           VARIANTS (j2store_variants)
        ========================= */
        v.j2store_variant_id                         AS variant_id,
        v.is_master,
        v.sku                                        AS variant_sku,
        v.upc                                        AS variant_upc,
        v.price                                      AS variant_price,
        v.pricing_calculator,
        v.shipping                                   AS variant_shipping,
        REPLACE(REPLACE(REPLACE(v.params, CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS variant_params,
        v.length,
        v.width,
        v.height,
        v.length_class_id,
        v.weight                                     AS variant_weight,
        v.weight_class_id,
        v.created_on                                 AS variant_created_on,
        v.created_by                                 AS variant_created_by,
        v.modified_on                                AS variant_modified_on,
        v.modified_by                                AS variant_modified_by,
        v.manage_stock                               AS variant_manage_stock,
        v.quantity_restriction,
        v.min_out_qty,
        v.use_store_config_min_out_qty,
        v.min_sale_qty,
        v.use_store_config_min_sale_qty,
        v.max_sale_qty,
        v.use_store_config_max_sale_qty,
        v.notify_qty,
        v.use_store_config_notify_qty,
        v.availability,
        v.sold                                       AS variant_sold,
        v.allow_backorder,
        v.isdefault_variant,

        /* =========================
           QUANTITIES (j2store_productquantities) - by variant_id
        ========================= */
        pq.j2store_productquantity_id,
        REPLACE(REPLACE(REPLACE(pq.product_attributes, CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS product_attributes,
        pq.quantity,
        pq.on_hold,
        pq.sold                                      AS quantity_sold,

        /* =========================
           PRICES (j2store_product_prices) - tier pricing by variant_id
        ========================= */
        pr.j2store_productprice_id,
        pr.quantity_from,
        pr.quantity_to,
        pr.date_from,
        pr.date_to,
        pr.customer_group_id,
        pr.price                                     AS tier_price,
        REPLACE(REPLACE(REPLACE(pr.params, CHAR(9), ' '), CHAR(10), ' '), '"', '""') AS tier_price_params,

        /* =========================
           ROW NUMBERS (to prevent repetition)
        ========================= */
        ROW_NUMBER() OVER (
            PARTITION BY p.j2store_product_id
            ORDER BY v.j2store_variant_id, pr.j2store_productprice_id
        ) AS product_row_num,

        ROW_NUMBER() OVER (
            PARTITION BY v.j2store_variant_id
            ORDER BY pr.j2store_productprice_id
        ) AS variant_row_num

    FROM h9uxp_j2store_products p
    LEFT JOIN h9uxp_content c
        ON c.id = p.product_source_id

    LEFT JOIN h9uxp_categories cat
        ON cat.id = c.catid

    LEFT JOIN tag_agg ta
        ON ta.content_item_id = c.id

    LEFT JOIN h9uxp_j2store_productimages img
        ON img.product_id = p.j2store_product_id

    LEFT JOIN h9uxp_j2store_variants v
        ON v.product_id = p.j2store_product_id

    LEFT JOIN h9uxp_j2store_productquantities pq
        ON pq.variant_id = v.j2store_variant_id

    LEFT JOIN h9uxp_j2store_product_prices pr
        ON pr.variant_id = v.j2store_variant_id
)

SELECT
    /* =========================
       ALWAYS (IDs to keep rows linked)
    ========================= */
    product_id,
    variant_id,
    j2store_productprice_id,

    /* =========================
       PRODUCT + CONTENT + IMAGES (FIRST ROW OF PRODUCT ONLY)
    ========================= */
    CASE WHEN product_row_num = 1 THEN visibility END AS visibility,
    CASE WHEN product_row_num = 1 THEN product_source END AS product_source,
    CASE WHEN product_row_num = 1 THEN product_source_id END AS product_source_id,
    CASE WHEN product_row_num = 1 THEN product_type END AS product_type,
    CASE WHEN product_row_num = 1 THEN main_tag END AS main_tag,
    CASE WHEN product_row_num = 1 THEN taxprofile_id END AS taxprofile_id,
    CASE WHEN product_row_num = 1 THEN manufacturer_id END AS manufacturer_id,
    CASE WHEN product_row_num = 1 THEN vendor_id END AS vendor_id,
    CASE WHEN product_row_num = 1 THEN has_options END AS has_options,
    CASE WHEN product_row_num = 1 THEN addtocart_text END AS addtocart_text,
    CASE WHEN product_row_num = 1 THEN enabled END AS enabled,
    CASE WHEN product_row_num = 1 THEN plugins END AS plugins,
    CASE WHEN product_row_num = 1 THEN product_params END AS product_params,
    CASE WHEN product_row_num = 1 THEN created_on END AS created_on,
    CASE WHEN product_row_num = 1 THEN created_by END AS created_by,
    CASE WHEN product_row_num = 1 THEN modified_on END AS modified_on,
    CASE WHEN product_row_num = 1 THEN modified_by END AS modified_by,
    CASE WHEN product_row_num = 1 THEN up_sells END AS up_sells,
    CASE WHEN product_row_num = 1 THEN cross_sells END AS cross_sells,
    CASE WHEN product_row_num = 1 THEN productfilter_ids END AS productfilter_ids,

    CASE WHEN product_row_num = 1 THEN content_id END AS content_id,
    CASE WHEN product_row_num = 1 THEN content_title END AS content_title,
    CASE WHEN product_row_num = 1 THEN content_alias END AS content_alias,
    CASE WHEN product_row_num = 1 THEN content_introtext END AS content_introtext,
    CASE WHEN product_row_num = 1 THEN content_fulltext END AS content_fulltext,
    CASE WHEN product_row_num = 1 THEN content_state END AS content_state,
    CASE WHEN product_row_num = 1 THEN content_catid END AS content_catid,

    /* CATEGORY TITLE ONLY (FIRST ROW OF PRODUCT) */
    CASE WHEN product_row_num = 1 THEN categoryId END AS categoryId,

    CASE WHEN product_row_num = 1 THEN content_created END AS content_created,
    CASE WHEN product_row_num = 1 THEN content_created_by END AS content_created_by,
    CASE WHEN product_row_num = 1 THEN content_modified END AS content_modified,
    CASE WHEN product_row_num = 1 THEN content_modified_by END AS content_modified_by,
    CASE WHEN product_row_num = 1 THEN content_publish_up END AS content_publish_up,
    CASE WHEN product_row_num = 1 THEN content_publish_down END AS content_publish_down,
    CASE WHEN product_row_num = 1 THEN content_images_json END AS content_images_json,
    CASE WHEN product_row_num = 1 THEN content_urls_json END AS content_urls_json,
    CASE WHEN product_row_num = 1 THEN content_attribs END AS content_attribs,
    CASE WHEN product_row_num = 1 THEN content_version END AS content_version,
    CASE WHEN product_row_num = 1 THEN content_ordering END AS content_ordering,
    CASE WHEN product_row_num = 1 THEN content_metakey END AS content_metakey,
    CASE WHEN product_row_num = 1 THEN content_metadesc END AS content_metadesc,
    CASE WHEN product_row_num = 1 THEN content_access END AS content_access,
    CASE WHEN product_row_num = 1 THEN content_hits END AS content_hits,
    CASE WHEN product_row_num = 1 THEN content_metadata END AS content_metadata,
    CASE WHEN product_row_num = 1 THEN content_featured END AS content_featured,
    CASE WHEN product_row_num = 1 THEN content_language END AS content_language,
    CASE WHEN product_row_num = 1 THEN content_note END AS content_note,

    /* TAGS ONLY ON FIRST ROW OF PRODUCT */
    CASE WHEN product_row_num = 1 THEN tags END AS tags,

    CASE WHEN product_row_num = 1 THEN j2store_productimage_id END AS j2store_productimage_id,
    CASE WHEN product_row_num = 1 THEN main_image END AS main_image,
    CASE WHEN product_row_num = 1 THEN main_image_alt END AS main_image_alt,
    CASE WHEN product_row_num = 1 THEN thumb_image END AS thumb_image,
    CASE WHEN product_row_num = 1 THEN thumb_image_alt END AS thumb_image_alt,
    CASE WHEN product_row_num = 1 THEN additional_images END AS additional_images,
    CASE WHEN product_row_num = 1 THEN additional_images_alt END AS additional_images_alt,

    /* =========================
       VARIANT + QUANTITY (FIRST ROW OF VARIANT ONLY)
    ========================= */
    CASE WHEN variant_row_num = 1 THEN is_master END AS is_master,
    CASE WHEN variant_row_num = 1 THEN variant_sku END AS variant_sku,
    CASE WHEN variant_row_num = 1 THEN variant_upc END AS variant_upc,
    CASE WHEN variant_row_num = 1 THEN variant_price END AS variant_price,
    CASE WHEN variant_row_num = 1 THEN pricing_calculator END AS pricing_calculator,
    CASE WHEN variant_row_num = 1 THEN variant_shipping END AS variant_shipping,
    CASE WHEN variant_row_num = 1 THEN variant_params END AS variant_params,
    CASE WHEN variant_row_num = 1 THEN length END AS length,
    CASE WHEN variant_row_num = 1 THEN width END AS width,
    CASE WHEN variant_row_num = 1 THEN height END AS height,
    CASE WHEN variant_row_num = 1 THEN length_class_id END AS length_class_id,
    CASE WHEN variant_row_num = 1 THEN variant_weight END AS variant_weight,
    CASE WHEN variant_row_num = 1 THEN weight_class_id END AS weight_class_id,
    CASE WHEN variant_row_num = 1 THEN variant_created_on END AS variant_created_on,
    CASE WHEN variant_row_num = 1 THEN variant_created_by END AS variant_created_by,
    CASE WHEN variant_row_num = 1 THEN variant_modified_on END AS variant_modified_on,
    CASE WHEN variant_row_num = 1 THEN variant_modified_by END AS variant_modified_by,
    CASE WHEN variant_row_num = 1 THEN variant_manage_stock END AS variant_manage_stock,
    CASE WHEN variant_row_num = 1 THEN quantity_restriction END AS quantity_restriction,
    CASE WHEN variant_row_num = 1 THEN min_out_qty END AS min_out_qty,
    CASE WHEN variant_row_num = 1 THEN use_store_config_min_out_qty END AS use_store_config_min_out_qty,
    CASE WHEN variant_row_num = 1 THEN min_sale_qty END AS min_sale_qty,
    CASE WHEN variant_row_num = 1 THEN use_store_config_min_sale_qty END AS use_store_config_min_sale_qty,
    CASE WHEN variant_row_num = 1 THEN max_sale_qty END AS max_sale_qty,
    CASE WHEN variant_row_num = 1 THEN use_store_config_max_sale_qty END AS use_store_config_max_sale_qty,
    CASE WHEN variant_row_num = 1 THEN notify_qty END AS notify_qty,
    CASE WHEN variant_row_num = 1 THEN use_store_config_notify_qty END AS use_store_config_notify_qty,
    CASE WHEN variant_row_num = 1 THEN availability END AS availability,
    CASE WHEN variant_row_num = 1 THEN variant_sold END AS variant_sold,
    CASE WHEN variant_row_num = 1 THEN allow_backorder END AS allow_backorder,
    CASE WHEN variant_row_num = 1 THEN isdefault_variant END AS isdefault_variant,

    CASE WHEN variant_row_num = 1 THEN j2store_productquantity_id END AS j2store_productquantity_id,
    CASE WHEN variant_row_num = 1 THEN product_attributes END AS product_attributes,
    CASE WHEN variant_row_num = 1 THEN quantity END AS quantity,
    CASE WHEN variant_row_num = 1 THEN on_hold END AS on_hold,
    CASE WHEN variant_row_num = 1 THEN quantity_sold END AS quantity_sold,

    /* =========================
       PRICE TIERS (ALWAYS)
    ========================= */
    quantity_from,
    quantity_to,
    date_from,
    date_to,
    customer_group_id,
    tier_price,
    tier_price_params

FROM base
ORDER BY
    product_id,
    variant_id,
    j2store_productprice_id;`
}