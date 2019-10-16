/**
 * @var {Object} wcmp
 *
 * @property {Object} wcmp.actions
 * @property {{export: String, add_shipments: String, add_return: String, get_labels: String}} wcmp.actions
 * @property {String} wcmp.ajax_url
 * @property {String} wcmp.nonce
 * @property {String} wcmp.download_display
 * @property {String} wcmp.offset
 * @property {String} wcmp.offset_icon
 */

// eslint-disable-next-line max-lines-per-function
jQuery(function($) {

  var selectors = {
    offsetDialog: '.wcmp__offset-dialog',
    offsetDialogInput: '.wcmp__offset-dialog__offset',
    printQueue: '.wcmp__print-queue',
    printQueueOffset: '.wcmp__print-queue__offset',
    saveShipmentSettings: '.wcmp__shipment-settings__save',
    shipmentOptions: '.wcmp__shipment-options',
    shipmentOptionsForm: '.wcmp__shipment-options__form',
    shipmentSummary: '.wcmp__shipment-summary',
    shipmentSummaryList: '.wcmp__shipment-summary__list',
    showShipmentOptionsForm: '.wcmp__shipment-options__show',
    showShipmentSummaryList: '.wcmp__shipment-summary__show',
    spinner: '.wcmp__spinner',
    notice: '.wcmp__notice',
    orderAction: '.wcmp__action',
    bulkSpinner: '.wcmp__bulk-spinner',
    orderActionImage: '.wcmp__action__img',
  };

  var spinner = {
    loading: 'loading',
    success: 'success',
    failed: 'failed',
  };

  addListeners();
  runTriggers();
  addDependencies();
  printQueuedLabels();

  var timeoutAfterRequest = 500;
  var baseEasing = 400;

  /**
   * Add event listeners.
   */
  function addListeners() {
    /**
     * Click offset dialog button (single export).
     */
    $(selectors.offsetDialog + ' button').click(printOrder);

    /**
     * Show and enable options when clicked.
     */
    $(selectors.showShipmentOptionsForm).click(showShipmentOptionsForm);

    // Add listeners to save buttons in shipment options forms.
    $(selectors.saveShipmentSettings).click(saveShipmentOptions);

    /**
     * Show summary when clicked.
     */
    $(selectors.showShipmentSummaryList).click(showShipmentSummaryList);

    /**
     * Bulk actions.
     */
    $('#doaction, #doaction2').click(doBulkAction);

    /**
     * Add offset dialog when address labels option is selected.
     */
    $('select[name=\'action\'], select[name=\'action2\']').change(showOffsetDialog);

    /**
     * Single actions click. The .wc_actions .single_wc_actions for support wc > 3.3.0.
     */
    $('.order_actions, .single_order_actions, .wc_actions, .single_wc_actions')
      .on('click', selectors.orderAction, onActionClick);

    $(window).bind('tb_unload', onThickBoxUnload);
  }

  /**
   * Run the things that need to be done on load.
   */
  function runTriggers() {
    /* init options on settings page and in bulk form */
    $('#wcmp_settings :input, .wcmp__bulk-options :input').change();

    /**
     * Move the shipment options form and the shipment summary from the actions column to the shipping address column.
     *
     * @see includes/admin/class-wcmp-admin.php:49
     */
    $([selectors.shipmentOptions, selectors.shipmentSummary].join(',')).each(function() {
      var shippingAddressColumn = $(this).closest('tr')
        .find('td.shipping_address');

      $(this).appendTo(shippingAddressColumn);
      $(this).show();
    });
  }

  /**
   * Add dependencies for form elements with conditions.
   */
  function addDependencies() {
    /**
     * Get all nodes with a data-parent attribute.
     */
    var nodesWithParent = document.querySelectorAll('[data-parent]');

    /**
     * Dependency object.
     *
     * @type {Object.<String, Node[]>}
     */
    var dependencies = {};

    /**
     * Loop through the classes to create a dependency like this: { [parent]: node[] }.
     */
    nodesWithParent.forEach(function(node) {
      var parent = node.getAttribute('data-parent');

      if (dependencies.hasOwnProperty(parent)) {
        dependencies[parent].push(node);
      } else {
        // Or create the list with the node inside it
        dependencies[parent] = [node];
      }
    });

    createDependencies(dependencies);
  }

  /**
   * Print queued labels.
   */
  function printQueuedLabels() {
    var print_queue = $(selectors.printQueue).val();
    var print_queue_offset = $(selectors.printQueueOffset).val();

    if (typeof print_queue !== 'undefined') {
      printLabel($.parseJSON(print_queue), print_queue_offset);
    }
  }

  /**
   * Handle showing and hiding of settings.
   *
   * @param {Object<String, Node[]>} deps - Dependency names and all the nodes that depend on them.
   */
  function createDependencies(deps) {
    Object.keys(deps).forEach(function(relatedInputId) {
      var relatedInput = document.querySelector('[name="' + relatedInputId + '"]');

      /**
       * Loop through all the deps.
       *
       * @param {Event|null} event - Event.
       * @param {Number} easing - Amount of easing.
       */
      function handle(event, easing) {
        if (easing === undefined) {
          easing = baseEasing;
        }

        /**
         * @type {Element} dependant
         */
        deps[relatedInputId].forEach(function(dependant) {
          handleDependency(relatedInput, dependant, null, easing);

          if (relatedInput.hasAttribute('data-parent')) {
            var otherRelatedInput = document.querySelector('[name="' + relatedInput.getAttribute('data-parent') + '"]');

            handleDependency(otherRelatedInput, relatedInput, dependant, easing);

            otherRelatedInput.addEventListener('change', function() {
              return handleDependency(otherRelatedInput, relatedInput, dependant, easing);
            });
          }
        });
      }

      relatedInput.addEventListener('change', handle);

      // Do this on load too.
      handle(null, 0);
    });
  }

  /**
   * @param {Element|Node} relatedInput - Parent of element.
   * @param {Element|Node} element  - Element that will be handled.
   * @param {Element|Node|null} element2 - Optional extra dependency of element.
   * @param {Number} easing - Amount of easing on the transitions.
   */
  function handleDependency(relatedInput, element, element2, easing) {
    var dataParentValue = element.getAttribute('data-parent-value');

    var type = element.getAttribute('data-parent-type');
    var wantedValue = dataParentValue || '1';
    var setValue = element.getAttribute('data-parent-set') || null;
    var value = relatedInput.value;

    var elementContainer = $(element).closest('tr');
    var elementCheckoutStringsTitleContainer = $('#checkout_strings');

    /**
     * @type {Boolean}
     */
    var matches;

    /*
     * If the data-parent-value contains any semicolons it's an array, check it as an array instead.
     */
    if (dataParentValue && dataParentValue.indexOf(';') > -1) {
      matches = dataParentValue
        .split(';')
        .indexOf(value) > -1;
    } else {
      matches = value === wantedValue;
    }
    switch (type) {
      case 'child':
        elementContainer[matches ? 'show' : 'hide'](easing);
        break;
      case 'show':
        elementContainer[matches ? 'show' : 'hide'](easing);
        elementCheckoutStringsTitleContainer[matches ? 'show' : 'hide'](easing);
        break;
      case 'disable':
        $(element).prop('disabled', !matches);
        if (!matches && setValue) {
          element.value = setValue;
        }
        break;
    }

    relatedInput.setAttribute('data-enabled', matches.toString());
    element.setAttribute('data-enabled', matches.toString());

    if (element2) {
      var showOrHide = element2.getAttribute('data-enabled') === 'true'
        && element.getAttribute('data-enabled') === 'true';

      $(element2).closest('tr')
        [showOrHide ? 'show' : 'hide'](easing);
      relatedInput.setAttribute('data-enabled', showOrHide.toString());
    }
  }

  /**
   * Show a shipment options form.
   *
   * @param {Event} event - Click event.
   */
  function showShipmentOptionsForm(event) {
    event.preventDefault();
    var form = $(this).next(selectors.shipmentOptionsForm);

    if (form.is(':visible')) {
      // Form is already visible, hide it
      form.slideUp();

      // Remove the listener to close the form.
      document.removeEventListener('click', hideShipmentOptionsForm);
    } else {
      // Form is invisible, show it
      form.find(':input').change();
      form.slideDown();
      // Add the listener to close the form.
      document.addEventListener('click', hideShipmentOptionsForm);
    }
  }

  function setSpinner(element, state) {
    var baseSelector = selectors.spinner.replace('.', '');
    var spinner = $(element).find(selectors.spinner);

    if (state) {
      spinner
        .removeClass()
        .addClass(baseSelector)
        .addClass(baseSelector + '--' + state)
        .show();
    } else {
      spinner
        .removeClass()
        .addClass(baseSelector)
        .hide();
    }
  }

  /**
   * Save the shipment options in the bulk form.
   */
  function saveShipmentOptions() {
    var button = this;
    var form = $(button).closest(selectors.shipmentOptionsForm);

    doRequest.bind(button)({
      url: wcmp.ajax_url,
      data: {
        action: 'wcmp_save_shipment_options',
        form_data: form.find(':input').serialize(),
        security: wcmp.nonce,
      },
      afterDone: function() {
        setTimeout(function() {
          form.slideUp();
        }, timeoutAfterRequest);
      },
    });
  }

  /**
   * @param {Event} event - Click event.
   */
  function doBulkAction(event) {
    var prefixLength = 5;

    var selectedAction = $(this)
      .attr('id')
      .substr(2);

    /*
     * Get related select with actions
     */
    var element = $('select[name="' + selectedAction + '"]');

    /* check if action starts with 'wcmp_' */
    if (element.val().substring(0, prefixLength) === 'wcmp_') {
      event.preventDefault();

      /*
       * Remove notices
       */
      $(selectors.notice).remove();

      /* strip 'wcmp_' from action */
      var action = element.val().substring(prefixLength);

      /* Get array of checked orders (order_ids) */
      var order_ids = [];
      var rows = [];

      $('tbody th.check-column input[type="checkbox"]:checked').each(
        function() {
          order_ids.push($(this).val());
          rows.push('.post-' + $(this).val());
        }
      );

      $(rows.join(', ')).addClass('wcmp__loading');

      switch (action) {
        /**
         * Export orders.
         */
        case 'export':
          exportToMyParcel(order_ids);
          break;

        /**
         * Print labels.
         */
        case 'print':
          printLabel(order_ids, wcmp.offset === 1 ? $(selectors.offsetDialogInput).val() : 0, rows);
          break;

        /**
         * Export and print.
         */
        case 'export_print':
          exportToMyParcel(order_ids, 'after_reload');
          break;
      }
    }
  }

  /**
   * Do an ajax request.
   *
   * @param {Object} request - Request object.
   */
  function doRequest(request) {
    var button = this;

    $(button).prop('disabled', true);
    setSpinner(button, spinner.loading);

    if (!request.url) {
      request.url = wcmp.ajax_url;
    }

    $.ajax({
      url: request.url,
      method: request.method || 'POST',
      data: request.data,
    })
      .done(function(res) {
        setSpinner(button, spinner.success);

        if (request.hasOwnProperty('afterDone') && typeof request.afterDone === 'function') {
          request.afterDone(res);
        }
      })

      .fail(function(res) {
        setSpinner(button, spinner.failed);

        if (request.hasOwnProperty('afterFail') && typeof request.afterFail === 'function') {
          request.afterFail(res);
        }
      })

      .always(function(res) {
        $(button).prop('disabled', false);

        if (request.hasOwnProperty('afterAlways') && typeof request.afterAlways === 'function') {
          request.afterAlways(res);
        }
      });
  }

  function getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, '\\$&');

    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    var results = regex.exec(url);

    if (!results) {
      return null;
    }

    if (!results[2]) {
      return '';
    }

    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  /**
   * On clicking the actions in a single order.
   *
   * @param {Event} event - Click event.
   */
  function onActionClick(event) {
    var button = this;

    var request = getParameterByName('request', button.href);
    var order_ids = getParameterByName('order_ids', button.href);

    switch (request) {
      case wcmp.actions.add_shipments:
        event.preventDefault();
        exportToMyParcel.bind(button)();
        break;
      /*
       * case wcmp.actions.get_labels:
       *   if (wcmp.offset === 1) {
       *     contextual_offset_dialog(order_ids, event);
       *   } else {
       *     printLabel.bind(button)();
       *   }
       *   break;
       */
      case wcmp.actions.add_return:
        event.preventDefault();
        myparcelbe_modal_dialog(order_ids, 'return');
        break;
    }
  }

  function showOffsetDialog() {
    var actionselected = $(this).val();
    var offsetDialog = $(selectors.offsetDialog);

    if ((actionselected === 'wcmp_print' || actionselected === 'wcmp_export_print') && wcmp.offset === 1) {
      var insert_position = $(this).attr('name') === 'action' ? 'top' : 'bottom';

      offsetDialog
        .attr('style', 'clear:both') /* reset styles */
        .insertAfter('div.tablenav.' + insert_position)
        .show();

      /* make sure button is not shown */
      offsetDialog.find('button').hide();
      /* clear input */
      offsetDialog.find('input').val('');
    } else {
      offsetDialog
        .appendTo('body')
        .hide();
    }
  }

  function printOrder() {
    var dialog = $(this).parent();

    /* set print variables */
    var order_ids = [dialog.find('input.order_id').val()];
    var offset = dialog.find(selectors.offsetDialogInput).val();

    /* hide dialog */
    dialog.hide();

    /* print labels */
    printLabel(order_ids, offset);
  }

  /**
   * Place offset dialog at mouse tip.
   */
  function contextual_offset_dialog(order_ids, event) {
    var offsetDialog = $(selectors.offsetDialog);

    offsetDialog
      .show()
      .appendTo('body')
      .css({
        top: event.pageY,
        left: event.pageX,
      });

    offsetDialog.find('button')
      .show()
      .data('order_id', order_ids);

    /* clear input */
    offsetDialog.find('input').val('');

    offsetDialog.append('<input type="hidden" class="order_id"/>');
    $(selectors.offsetDialog + ' input.order_id').val(order_ids);
  }

  /**
   * @param {Element} button - The button that was clicked.
   * @param {Boolean} display - To display or not to display.
   */
  function showButtonSpinner(button, display) {
    if (display) {
      var buttonImage = $(button).find(selectors.orderActionImage);
      buttonImage.hide();
      $(button).parent()
        .find(selectors.spinner)
        .insertAfter(buttonImage)
        .show();
    } else {
      $(button).parent()
        .find(selectors.spinner)
        .hide();
      $(button).find(selectors.orderActionImage)
        .show();
    }
  }

  /**
   * @param {Element} action - The action that was clicked.
   * @param {Boolean} display - To display or not to display.
   */
  function showBulkSpinner(action, display) {
    var submit_button = $(action)
      .parent()
      .find('.button.action');

    if (display) {
      $(selectors.bulkSpinner)
        .insertAfter(submit_button)
        .show();
    } else {
      $(selectors.bulkSpinner).hide();
    }
  }

  /* export orders to MyParcel via AJAX */
  function exportToMyParcel(order_ids, print) {
    var offset = wcmp.offset === 1 ? $(selectors.offsetDialogInput).val() : 0;
    var url;
    var data;

    if (typeof print === 'undefined') {
      print = 'no';
    }

    if (this.href) {
      url = this.href;
    } else {
      data = {
        action: wcmp.actions.add_shipments,
        offset: offset,
        order_ids: order_ids,
        print: print,
      };
    }

    doRequest.bind(this)({
      url: url,
      data: data || {},
      afterDone: function(response) {
        var redirect_url = updateUrlParameter(window.location.href, 'myparcelbe_done', 'true');
        // response = $.parseJSON(response);

        if (print === 'no' || print === 'after_reload') {
          /* refresh page, admin notices are stored in options and will be displayed automatically */
          window.location.href = redirect_url;
        } else {
          /* when printing, output notices directly so that we can init print in the same run */
          if (response !== null && typeof response === 'object' && 'error' in response) {
            myparcelbe_admin_notice(response.error, 'error');
          }

          if (response !== null && typeof response === 'object' && 'success' in response) {
            myparcelbe_admin_notice(response.success, 'success');
          }

          /* load PDF */
          printLabel(order_ids, offset);
        }
      },
    });
  }

  function myparcelbe_modal_dialog(order_ids, dialog) {
    var request_prefix = (wcmp.ajax_url.indexOf('?') !== -1) ? '&' : '?';
    var thickbox_parameters = '&TB_iframe=true&height=380&width=720';
    var url = wcmp.ajax_url
      + request_prefix
      + 'order_ids='
      + order_ids
      + '&action=wcmp&request=modal_dialog&dialog='
      + dialog
      + '&security='
      + wcmp.nonce
      + thickbox_parameters;

    /* disable background scrolling */
    $('body').css({overflow: 'hidden'});

    tb_show('', url);
  }

  /**
   *  Re-enable scrolling after closing thickbox.
   */
  function onThickBoxUnload() {
    $('body').css({overflow: 'inherit'});
  }

  /* export orders to MyParcel via AJAX */
  function myparcelbe_return(order_ids) {
    var data = {
      action: 'wcmp',
      request: wcmp.actions.add_return,
      order_ids: order_ids,
      security: wcmp.nonce,
    };

    $.post(wcmp.ajax_url, data, function(response) {
      response = $.parseJSON(response);
      if (response !== null && typeof response === 'object' && 'error' in response) {
        myparcelbe_admin_notice(response.error, 'error');
      }

    });

  }

  /**
   *
   * @param pdf
   */
  function displayPdf(pdf) {
    var string = 'data:application/pdf;base64, ' + pdf;

    var file = new Blob(['base64, ' + pdf], {type: 'application/pdf'});
    var fileURL = URL.createObjectURL(file);
    console.log(fileURL);
    throw 'die';
    window.open(fileURL);

    /*
     * var iframe = '<object '
     *   + 'width=\'100%\' '
     *   + 'height=\'100%\' '
     *   + 'style="border: 0;" '
     *   + 'data=\''
     *   + string
     *   + '\' />';
     * var newWindow = window.open();
     * newWindow.document.title = "pdf file";
     * newWindow.document.open();
     * newWindow.document.write(iframe);
     * newWindow.document.querySelector('body').style.padding = '0';
     * newWindow.document.querySelector('body').style.margin = '0';
     * newWindow.document.close();
     */
  };

  /**
   * @param {String} pdf - The created pdf as a string.
   */
  function downloadPdf(pdf) {
    console.log('downloading');

    $.post('');
    /*
     * if (window.navigator && window.navigator.msSaveOrOpenBlob) { // IE workaround
     *   var byteCharacters = atob(pdf, true);
     *   var byteNumbers = new Array(byteCharacters.length);
     *   for (var i = 0; i < byteCharacters.length; i++) {
     *     byteNumbers[i] = byteCharacters.charCodeAt(i);
     *   }
     *
     *   var byteArray = new Uint8Array(byteNumbers);
     *   var blob = new Blob([byteArray], {type: 'application/pdf'});
     *   window.navigator.msSaveOrOpenBlob(blob, your_file_name);
     * } else { // much easier if not IE
     *   window.open('data:application/pdf;base64, ' + pdf, '', 'height=600,width=800');
     * }
     */
  }

  /* Request MyParcel BE labels */
  function printLabel(order_ids) {
    var offset = offset || 0;
    var request = '';

    if (this.href) {
      request = this.href;
    } else {
      var request_prefix = (wcmp.ajax_url.indexOf('?') !== -1) ? '&' : '?';
      request = wcmp.ajax_url + request_prefix + 'action=wc_myparcel&request=get_labels&security=' + wcmp.nonce;
    }

    /* create form to send order_ids via POST */
    $('body').append('<form action="' + request + '" method="post" target="_blank" id="wcmp__post_data"></form>');
    var postData = $('#wcmp__post_data');
    // postData.append('<input type="hidden" name="pdf" value="' + result + '"/>');
    postData.append('<input type="hidden" name="offset" class="offset" value="' + offset + '"/>');
    postData.append('<input type="hidden" name="order_ids" class="order_ids" value="' + order_ids + '" />');

    /* submit data to open or download pdf */
    postData.submit();
  }

  function myparcelbe_admin_notice(message, type) {
    var mainHeader = $('#wpbody-content > .wrap > h1:first');
    var notice = '<div class="' + selectors.notice + ' notice notice-' + type + '"><p>' + message + '</p></div>';
    mainHeader.after(notice);
    $('html, body').animate({scrollTop: 0}, 'slow');
  }

  /* Add / Update a key-value pair in the URL query parameters */

  /* https://gist.github.com/niyazpk/f8ac616f181f6042d1e0 */
  function updateUrlParameter(uri, key, value) {
    /* remove the hash part before operating on the uri */
    var i = uri.indexOf('#');
    var hash = i === -1 ? '' : uri.substr(i);
    uri = i === -1 ? uri : uri.substr(0, i);

    var re = new RegExp('([?&])' + key + '=.*?(&|$)', 'i');
    var separator = uri.indexOf('?') !== -1 ? '&' : '?';
    if (uri.match(re)) {
      uri = uri.replace(re, '$1' + key + '=' + value + '$2');
    } else {
      uri = uri + separator + key + '=' + value;
    }
    return uri + hash; /* finally append the hash as well */
  }

  function showShipmentSummaryList() {
    var summaryList = $(this).next(selectors.shipmentSummaryList);

    if (summaryList.is(':hidden')) {
      summaryList.slideDown();
      document.addEventListener('click', hideShipmentSummaryList);
    } else {
    }

    if (summaryList.data('loaded') === '') {
      summaryList.addClass('ajax-waiting');
      summaryList.find(selectors.spinner).show();

      var data = {
        security: wcmp.nonce,
        action: 'wcmp_get_shipment_summary_status',
        order_id: summaryList.data('order_id'),
        shipment_id: summaryList.data('shipment_id'),
      };

      $.ajax({
        type: 'POST',
        url: wcmp.ajax_url,
        data: data,
        context: summaryList,
        success: function(response) {
          this.removeClass('ajax-waiting');
          this.html(response);
          this.data('loaded', true);
        },
      });
    }
  }

  /**
   * @param {MouseEvent} event - The click event.
   * @param {Element} event.target - Click target.
   */
  function hideShipmentOptionsForm(event) {
    handleClickOutside.bind(hideShipmentOptionsForm)(event, {
      main: selectors.shipmentOptionsForm,
      wrappers: [selectors.shipmentOptionsForm, selectors.showShipmentOptionsForm],
    });
  }

  /**
   * @param {MouseEvent} event - Click event.
   * @property {Element} event.target
   */
  function hideShipmentSummaryList(event) {
    handleClickOutside.bind(hideShipmentSummaryList)(event, {
      main: selectors.shipmentSummaryList,
      wrappers: [selectors.shipmentSummaryList, selectors.showShipmentSummaryList],
    });
  }

  /**
   * Hide any element by checking if the element clicked is not in the list of wrapper elements and not inside the
   *  element itself.
   *
   * @param {MouseEvent} event - The click event.
   * @param {Object} elements - The elements to show/hide and check inside.
   * @property {Node[]} elements.wrappers
   * @property {Node} elements.main
   */
  function handleClickOutside(event, elements) {
    event.preventDefault();
    var listener = this;
    var clickedOutside = true;

    elements.wrappers.forEach(function(cls) {
      if ((clickedOutside && event.target.matches(cls)) || event.target.closest(elements.main)) {
        clickedOutside = false;
      }
    });

    if (clickedOutside) {
      $(elements.main).slideUp();
      document.removeEventListener('click', listener);
    }
  }
});

