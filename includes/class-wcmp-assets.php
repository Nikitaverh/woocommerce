<?php

if (!defined('ABSPATH')) {
    exit;
} // Exit if accessed directly

if (!class_exists('wcmp_assets')) :

    class wcmp_assets
    {

        function __construct()
        {
            add_action('admin_enqueue_scripts', [$this, 'backend_scripts_styles']);
        }

        /**
         * Load styles & scripts
         */
        public function backend_scripts_styles()
        {
            global $post_type;
            $screen = get_current_screen();
            if ($post_type == 'shop_order' || (is_object($screen) && strpos($screen->id, 'myparcel') !== false)) {
                // WC2.3+ load all WC scripts for shipping_method search!
                if (version_compare(WOOCOMMERCE_VERSION, '2.3', '>=')) {
                    wp_enqueue_script('woocommerce_admin');
                    wp_enqueue_script('iris');
                    if (!wp_script_is('wc-enhanced-select', 'registered')) {
                        $suffix = defined('SCRIPT_DEBUG') && SCRIPT_DEBUG ? '' : '.min';
                        wp_register_script(
                            'wc-enhanced-select',
                            WC()->plugin_url() . '/assets/js/admin/wc-enhanced-select' . $suffix . '.js',
                            ['jquery', version_compare(WC()->version, '3.2.0', '>=') ? 'selectWoo' : 'select2'],
                            WC_VERSION
                        );
                    }
                    wp_enqueue_script('wc-enhanced-select');
                    wp_enqueue_script('jquery-ui-sortable');
                    wp_enqueue_script('jquery-ui-autocomplete');
                    wp_enqueue_style(
                        'woocommerce_admin_styles',
                        WC()->plugin_url() . '/assets/css/admin.css',
                        [],
                        WC_VERSION
                    );
                }

                // Add the color picker css file
                wp_enqueue_style('wp-color-picker');
                wp_enqueue_script('thickbox');
                wp_enqueue_style('thickbox');
                wp_enqueue_script(
                    'wcmyparcelbe-export',
                    WooCommerce_MyParcelBE()->plugin_url() . '/assets/js/wcmp-admin.js',
                    ['jquery', 'thickbox', 'wp-color-picker'],
                    WC_MYPARCEL_BE_VERSION
                );
                wp_localize_script(
                    'wcmyparcelbe-export',
                    'wc_myparcelbe',
                    [
                        'ajax_url' => admin_url('admin-ajax.php'),
                        'nonce' => wp_create_nonce('wc_myparcelbe'),
                        'download_display' => WooCommerce_MyParcelBE()->setting_collection->getByName(
                            'download_display'
                        ) ? WooCommerce_MyParcelBE()->setting_collection->getByName('download_display') : '',
                        'offset' => WooCommerce_MyParcelBE()->setting_collection->getByName(
                            'print_position_offset'
                        ) ? WooCommerce_MyParcelBE()->setting_collection->getByName('print_position_offset') : '',
                        'offset_icon' => WooCommerce_MyParcelBE()->plugin_url()
                            . '/assets/img/print-offset-icon.png',
                        'offset_label' => __('Labels to skip', 'woocommerce-myparcel'),
                    ]
                );

                wp_enqueue_style(
                    'wcmp-admin-styles',
                    WooCommerce_MyParcelBE()->plugin_url() . '/assets/css/wcmp-admin-styles.css',
                    [],
                    WC_MYPARCEL_BE_VERSION,
                    'all'
                );

                // Legacy styles (WC 2.1+ introduced MP6 style with larger buttons)
                if (version_compare(WOOCOMMERCE_VERSION, '2.1', '<=')) {
                    wp_enqueue_style(
                        'wcmp-admin-styles-legacy',
                        WooCommerce_MyParcelBE()->plugin_url() . '/assets/css/wcmp-admin-styles-legacy.css',
                        [],
                        WC_MYPARCEL_BE_VERSION,
                        'all'
                    );
                }
            }
        }
    }
endif; // class_exists

return new wcmp_assets();
