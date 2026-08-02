/**
 * AI Product Summary Engine & Side Drawer Controller
 * RentOPC - Shopify Theme Implementation
 */
(function () {
  var currentLang = 'en'; // Default language

  var translations = {
    // Labels & Headers
    "At a Glance": "एक नज़र में",
    "Specifications": "तकनीकी विशेषताएं",
    "Best Suited For": "इनके लिए सबसे उपयुक्त",
    "Can It Handle?": "क्या यह संभाल सकता है?",
    "Translate to Hindi": "हिंदी में अनुवाद करें",
    "Translate to English": "English में अनुवाद करें",
    "AI Product Summary": "AI उत्पाद सारांश",
    "Simplified specifications at a glance": "एक नज़र में सरल विशेषताएं",
    "AI Summary": "AI सारांश",

    // Specs keys
    "Processor": "प्रोसेसर",
    "Generation": "जनरेशन",
    "RAM": "रैम",
    "Storage": "स्टोरेज",
    "Graphics": "ग्राफिक्स",
    "Condition": "कंडीशन",
    "Battery": "बैटरी",
    "Warranty": "वारंटी",
    "Weight": "वजन",

    // Checkbox items
    "Microsoft Office": "माइक्रोसॉफ्ट ऑफिस",
    "Google Chrome": "गूगल क्रोम",
    "Zoom Meetings": "ज़ूम मीटिंग्स",
    "VS Code / Programming": "वीएस कोड / प्रोग्रामिंग",
    "Photoshop (Basic)": "फ़ोटोशॉप (बुनियादी)",
    "Figma (Web & App)": "फ़िग्मा (वेब और ऐप)",
    "20+ Browser Tabs Open": "20+ ब्राउज़र टैब्स",
    "Modern AAA Gaming": "हाई-एंड गेमिंग",
    "Pro Video Editing (4K)": "प्रो वीडियो एडिटिंग (4K)",
    "High-end 3D Rendering": "3D रेंडरिंग",
    "Not specified": "निर्दिष्ट नहीं",

    // Badges/Cohort
    "Browsing": "वेब ब्राउज़िंग",
    "Online Classes": "ऑनलाइन क्लास",
    "Office Work": "ऑफिस का काम",
    "Students": "छात्रों के लिए",
    "Remote Work": "रिमोट वर्क",
    "Programming": "प्रोग्रामिंग",
    "Accounting": "अकाउंटिंग",
    "Business": "बिजनेस",
    "Multitasking": "मल्टीटास्किंग",

    // Dynamic strings / Adjectives
    "dependable": "भरोसेमंद",
    "premium and high-performance": "प्रीमियम और हाई-परफॉर्मेंस",
    "highly capable": "अत्यंत सक्षम",
    "dependable everyday": "रोजमर्रा के लिए भरोसेमंद",
    "budget-friendly": "किफायती",
    
    "students and office professionals": "छात्रों और ऑफिस प्रोफेशनल्स",
    "developers, business professionals, and demanding multitaskers": "डेवलपर्स, बिजनेस प्रोफेशनल्स और मल्टीटास्कर्स",
    "office managers, programmers, and active multitaskers": "ऑफिस मैनेजर्स, प्रोग्रामर्स और मल्टीटास्कर्स",
    "students, remote workers, and office professionals": "छात्रों, रिमोट वर्कर्स और ऑफिस प्रोफेशनल्स",
    "students, light web browsers, and budget-conscious users": "छात्रों और बजट-सचेत यूज़र्स",
    
    "web browsing, document editing, and online classes": "वेब ब्राउज़िंग, डॉक्यूमेंट एडिटिंग और ऑनलाइन क्लासेज",
    "software development, database management, heavy multitasking, and complex spreadsheet work": "सॉफ्टवेयर डेवलपमेंट, डेटाबेस और भारी मल्टीटास्किंग",
    "running multiple web apps, coding, large excel sheets, and video meetings": "कोडिंग, एक्सेल और वीडियो मीटिंग्स",
    "video calls, office productivity apps, web research, and multitasking": "वीडियो कॉल्स, ऑफिस ऐप्स और वेब रिसर्च",
    "basic word processing, web browsing, and watching online video content": "बेसिक वर्ड प्रोसेसिंग और वेब ब्राउज़िंग",

    "a capable": "एक सक्षम",
    "processor": "प्रोसेसर",
    "of RAM": "रैम",
    "fast SSD storage": "फास्ट SSD स्टोरेज",
    
    "isn't designed for modern AAA gaming or professional 3D rendering": "हाई-एंड गेमिंग या 3D रेंडरिंग के लिए उपयुक्त नहीं है",
    "can handle entry-level creative work or casual gaming, but is not intended for heavy competitive 3D gaming": "बुनियादी क्रिएटिव वर्क या कैजुअल गेमिंग संभाल सकता है",
    
    "This": "यह",
    "choice for": "उन",
    "looking for a reliable laptop.": "के लिए एक बढ़िया विकल्प है जो एक टिकाऊ लैपटॉप ढूंढ रहे हैं।",
    "Its": "इसके",
    "deliver smooth performance for": "सुचारू प्रदर्शन प्रदान करते हैं।",
    "While it": "हालांकि यह",
    "it delivers excellent overall value and durable performance for daily tasks.": "फिर भी यह दैनिक कार्यों के लिए उत्कृष्ट मूल्य और टिकाऊ प्रदर्शन प्रदान करता है。"
  };

  function t(text, lang) {
    if (lang === 'hi' && translations[text]) {
      return translations[text];
    }
    return text;
  }

  function cleanSpecValue(val) {
    if (!val) return '';
    var cleaned = val.replace(/\s*\([^)]*\)/g, '');
    cleaned = cleaned.replace(/\s+(cpu|processor)\b/gi, '');
    return cleaned.trim();
  }

  /**
   * Rule-Based AI Product Summary Generator (V1 Abstraction)
   * 
   * @param {Object} product The product data object including specs, tags, and selected variant.
   * @param {String} lang The output language ('en' or 'hi').
   * @returns {Object} Generated summary sections
   */
  function generateProductSummary(product, lang) {
    lang = lang || 'en';

    // 1. Parse RAM
    var ramRaw = product.ram || (product.selected_variant && product.selected_variant.option1 ? product.selected_variant.option1 : '');
    var matchRam = ramRaw.match(/(\d+)\s*(?:GB|gb)?/i);
    var ramGb = matchRam ? parseInt(matchRam[1]) : 8;

    // 2. Parse Storage
    var storageRaw = product.storage || (product.selected_variant && product.selected_variant.option2 ? product.selected_variant.option2 : '');
    var storageStr = storageRaw.toUpperCase();
    var isSSD = storageStr.includes('SSD') || storageStr.includes('NVME') || storageStr.includes('FLASH');

    // 3. Parse Weight
    var weightRaw = product.weight || '1.5 kg';
    var weightKg = parseFloat(weightRaw.replace(/[^0-9.]/g, '')) || 1.5;
    var isLightweight = weightKg < 1.6;

    // 4. Parse Processor and Generation
    var processorStr = (product.processor || '').toUpperCase();
    var generationStr = (product.generation || '').toUpperCase();
    var genNum = parseInt(generationStr.replace(/[^0-9]/g, '')) || 8;

    // 5. Parse Graphics
    var graphicsStr = (product.graphics || '').toUpperCase();
    var hasDedicatedGPU = graphicsStr.includes('NVIDIA') || 
                           graphicsStr.includes('AMD') || 
                           graphicsStr.includes('GEFORCE') || 
                           graphicsStr.includes('RTX') || 
                           graphicsStr.includes('GTX') || 
                           graphicsStr.includes('RADEON DEDICATED') || 
                           graphicsStr.includes('DEDICATED');

    // 6. Business Laptop check
    var titleUpper = (product.title || '').toUpperCase();
    var vendorUpper = (product.vendor || '').toUpperCase();
    var tagsStr = (product.tags || []).join(' ').toUpperCase();
    
    var isBusinessLaptop = titleUpper.includes('THINKPAD') || 
                           titleUpper.includes('LATITUDE') || 
                           titleUpper.includes('ELITEBOOK') || 
                           vendorUpper.includes('THINKPAD') || 
                           vendorUpper.includes('DELL') || 
                           tagsStr.includes('BUSINESS') || 
                           tagsStr.includes('THINKPAD');

    // Normalize Brand
    var brand = product.vendor || 'Lenovo';
    var knownBrands = ['DELL', 'LENOVO', 'HP', 'APPLE', 'ASUS', 'ACER', 'MICROSOFT'];
    var matchedBrand = '';
    for (var i = 0; i < knownBrands.length; i++) {
      if (titleUpper.includes(knownBrands[i])) {
        matchedBrand = knownBrands[i];
        break;
      }
    }
    if ((brand.toUpperCase().includes('RENTOPC') || brand.toUpperCase().includes('RENT OPC')) && matchedBrand) {
      brand = matchedBrand.charAt(0) + matchedBrand.slice(1).toLowerCase();
    }

    var cleanTitle = product.title || '';
    if (cleanTitle.toUpperCase().indexOf('RENTOPC') === 0) {
      cleanTitle = cleanTitle.slice(7).trim();
    }
    var brandLower = brand.toLowerCase();
    if (cleanTitle.toLowerCase().indexOf(brandLower) === 0) {
      cleanTitle = cleanTitle.slice(brandLower.length).trim();
    }
    cleanTitle = cleanTitle.split(' - ')[0]
                           .split(' (')[0]
                           .replace(/\b(Core i[0-9]|Ryzen [0-9]|Ram|SSD|GB|TB|Gen|Cpu|GHz|Intel)\b.*/gi, '')
                           .trim();

    if (cleanTitle.length > 0) {
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }

    // Determine Audiences & Adjectives
    var adjective = "dependable";
    var audiences = "students and office professionals";
    var activities = "web browsing, document editing, and online classes";

    if (ramGb >= 16 && genNum >= 10) {
      adjective = "premium and high-performance";
      audiences = "developers, business professionals, and demanding multitaskers";
      activities = "software development, database management, heavy multitasking, and complex spreadsheet work";
    } else if (ramGb >= 16) {
      adjective = "highly capable";
      audiences = "office managers, programmers, and active multitaskers";
      activities = "running multiple web apps, coding, large excel sheets, and video meetings";
    } else if (ramGb >= 8 && genNum >= 8) {
      adjective = "dependable everyday";
      audiences = "students, remote workers, and office professionals";
      activities = "video calls, office productivity apps, web research, and multitasking";
    } else {
      adjective = "budget-friendly";
      audiences = "students, light web browsers, and budget-conscious users";
      activities = "basic word processing, web browsing, and watching online video content";
    }

    var cleanProc = cleanSpecValue(product.processor);
    var cleanGen = cleanSpecValue(product.generation);
    var procLower = cleanProc.toLowerCase();
    var hasGenInProc = procLower.includes('gen') || procLower.includes('generation') || /[0-9]+th\b/.test(procLower);

    var hardwareHighlights = [];
    if (cleanProc) {
      var pName = cleanProc;
      if (cleanGen && !hasGenInProc && !procLower.includes(cleanGen.toLowerCase())) {
        if (!cleanGen.toLowerCase().includes('above')) {
          pName += " (" + cleanGen + ")";
        }
      }
      hardwareHighlights.push(lang === 'hi' ? (t(cleanProc, 'hi') + " प्रोसेसर") : ("a capable " + pName + " processor"));
    }
    if (ramGb) {
      hardwareHighlights.push(ramGb + "GB " + t("of RAM", lang));
    }
    if (isSSD) {
      hardwareHighlights.push(t("fast SSD storage", lang));
    }

    var limitClause = "isn't designed for modern AAA gaming or professional 3D rendering";
    if (hasDedicatedGPU) {
      limitClause = "can handle entry-level creative work or casual gaming, but is not intended for heavy competitive 3D gaming";
    }

    var conditionStr = (product.condition || 'Renewed').toLowerCase();
    var condDisplay = conditionStr;
    if (lang === 'hi') {
      condDisplay = conditionStr === 'renewed' ? 'नवीनीकृत (Renewed)' : 'नया (New)';
    }

    // Build natural simplified 1-sentence summary
    var quickSummaryText = "";
    if (lang === 'hi') {
      quickSummaryText = "यह " + condDisplay + " " + brand + " " + cleanTitle + " लैपटॉप " + t(audiences, 'hi') + " के लिए एक " + t(adjective, 'hi') + " विकल्प है, जो " + t(activities, 'hi') + " के लिए बेहतरीन प्रदर्शन प्रदान करता है।";
    } else {
      quickSummaryText = "This " + conditionStr + " " + brand + " " + cleanTitle + " laptop is a " + adjective + " choice for " + audiences + ", delivering smooth performance for " + activities + ".";
    }

    // Best For Badges
    var bestFor = [];
    bestFor.push("Browsing");
    bestFor.push("Online Classes");
    bestFor.push("Office Work");
    if (ramGb >= 8) {
      bestFor.push("Students");
      bestFor.push("Remote Work");
    }
    if (ramGb >= 16 || (ramGb >= 8 && genNum >= 8)) {
      bestFor.push("Programming");
      bestFor.push("Accounting");
    }
    if (isBusinessLaptop) {
      bestFor.push("Business");
    }
    if (ramGb >= 16) {
      bestFor.push("Multitasking");
    }

    // Can It Handle Capabilities (Compact list of 4 key ones)
    var capabilities = [
      { name: "Microsoft Office", supported: true },
      { name: "Google Chrome", supported: true },
      { name: "Zoom Meetings", supported: true },
      { name: "VS Code / Programming", supported: ramGb >= 8 }
    ];

    // Specifications Pills List
    var specPills = [
      { label: "Processor", value: cleanProc },
      { label: "Generation", value: cleanGen },
      { label: "RAM", value: ramRaw },
      { label: "Storage", value: storageRaw },
      { label: "Graphics", value: cleanSpecValue(product.graphics) },
      { label: "Condition", value: product.condition },
      { label: "Warranty", value: product.warranty || '6 Months' }
    ];

    return {
      quickSummary: quickSummaryText,
      bestFor: bestFor,
      canItHandle: capabilities,
      specPills: specPills
    };
  }

  /**
   * DOM Renderer: Updates the HTML nodes inside the drawer.
   */
  function renderSummary(root, data, lang) {
    if (!root || !data) return;
    lang = lang || 'en';

    // Update section Titles/Headers in translated language
    var titleAtGlance = root.querySelector('[data-summary-title-at-a-glance]');
    if (titleAtGlance) titleAtGlance.textContent = t("At a Glance", lang);

    var titleSpecs = root.querySelector('[data-summary-title-specs]');
    if (titleSpecs) titleSpecs.textContent = t("Specifications", lang);

    var titleBestFor = root.querySelector('[data-summary-title-best-for]');
    if (titleBestFor) titleBestFor.textContent = t("Best Suited For", lang);

    var titleCanHandle = root.querySelector('[data-summary-title-can-handle]');
    if (titleCanHandle) titleCanHandle.textContent = t("Can It Handle?", lang);

    // 1. Quick Summary Paragraph
    var quickSummaryEl = root.querySelector('[data-summary-quick]');
    if (quickSummaryEl) {
      quickSummaryEl.textContent = data.quickSummary;
    }

    // 2. Specifications Pills Grid
    var specsPillsEl = root.querySelector('[data-summary-specs-pills]');
    if (specsPillsEl) {
      specsPillsEl.innerHTML = '';
      data.specPills.forEach(function (pill) {
        if (!pill.value) return;
        var badge = document.createElement('span');
        badge.className = 'badge badge--secondary';
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.padding = '0.6rem 1.2rem';
        badge.style.fontSize = '1.2rem';
        badge.style.borderRadius = '20px';
        badge.style.backgroundColor = '#ecf4ff';
        badge.style.color = '#16346a';
        badge.style.border = '1px solid #c9ddff';
        badge.style.fontWeight = '500';
        
        var translatedVal = t(pill.value, lang);
        if (pill.label === 'Condition' && lang === 'hi') {
          translatedVal = pill.value.toLowerCase() === 'renewed' ? 'नवीनीकृत (Renewed)' : 'नया (New)';
        }
        
        badge.innerHTML = '<strong style="margin-right: 0.4rem; color: #555;">' + t(pill.label, lang) + ':</strong> ' + translatedVal;
        specsPillsEl.appendChild(badge);
      });
    }

    // 3. Best For Badges/Chips
    var bestForEl = root.querySelector('[data-summary-best-for]');
    if (bestForEl) {
      bestForEl.innerHTML = '';
      data.bestFor.forEach(function (cohort) {
        var badge = document.createElement('span');
        badge.className = 'badge badge--secondary ai-summary-badge';
        badge.style.padding = '0.5rem 1rem';
        badge.style.fontSize = '1.15rem';
        badge.style.borderRadius = '4px';
        badge.style.backgroundColor = '#f1f5f9';
        badge.style.color = '#334155';
        badge.style.border = '1px solid #e2e8f0';
        badge.textContent = t(cohort, lang);
        bestForEl.appendChild(badge);
      });
    }

    // 4. Can It Handle? Checklist
    var handleEl = root.querySelector('[data-summary-handle]');
    if (handleEl) {
      handleEl.innerHTML = '';
      data.canItHandle.forEach(function (item) {
        var col = document.createElement('div');
        col.className = 'ai-summary-checklist-item ' + (item.supported ? 'can-handle' : 'cannot-handle');
        col.style.display = 'flex';
        col.style.alignItems = 'center';
        col.style.gap = '0.6rem';
        col.style.fontSize = '1.2rem';
        col.style.color = '#334155';
        
        var icon = document.createElement('span');
        icon.className = 'ai-summary-checklist-icon';
        icon.style.display = 'inline-flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.width = '1.8rem';
        icon.style.height = '1.8rem';
        icon.style.borderRadius = '50%';
        icon.style.fontSize = '1rem';
        icon.style.fontWeight = 'bold';
        
        if (item.supported) {
          icon.style.backgroundColor = '#dcfce7';
          icon.style.color = '#15803d';
          icon.innerHTML = '&#10003;';
        } else {
          icon.style.backgroundColor = '#fee2e2';
          icon.style.color = '#b91c1c';
          icon.innerHTML = '&#10005;';
        }
        
        var text = document.createElement('span');
        text.className = 'ai-summary-checklist-text';
        text.textContent = t(item.name, lang);
        
        col.appendChild(icon);
        col.appendChild(text);
        handleEl.appendChild(col);
      });
    }
  }

  function init(root) {
    var dataScript = root.querySelector('#ai-product-summary-data');
    if (!dataScript) return;

    var productData;
    try {
      productData = JSON.parse(dataScript.textContent || '{}');
    } catch (e) {
      console.error('Failed to parse AI Product Summary specs JSON', e);
      return;
    }

    var isLaptop = (productData.type || '').toUpperCase() === 'LAPTOP' || 
                   (productData.tags || []).join(' ').toUpperCase().includes('LAPTOP') ||
                   !!productData.processor;
    
    if (!isLaptop) {
      root.style.display = 'none';
      return;
    }

    var titleLC = (productData.title || '').toLowerCase();
    var vendorLC = (productData.vendor || '').toLowerCase();
    var handleLC = (productData.handle || '').toLowerCase();
    var isRental = titleLC.includes('rental') || vendorLC.includes('rental') || handleLC.includes('rental');
    
    if (isRental) {
      root.style.display = 'none';
      return;
    }

    var fab = root.querySelector('#AISummaryFAB');
    var drawer = root.querySelector('#AISummaryDrawer');
    var overlay = root.querySelector('#AISummaryDrawer-Overlay');
    var closeBtn = root.querySelector('#AISummaryClose');
    var tooltip = root.querySelector('#AISummaryFABTooltip');
    var translateBtn = root.querySelector('#AISummaryTranslateBtn');

    if (!fab || !drawer) return;

    function openDrawer() {
      document.body.classList.add('overflow-hidden', 'ai-summary-drawer-open');
      drawer.removeAttribute('hidden');
      drawer.offsetHeight;
      drawer.classList.add('animate', 'active');

      const inner = drawer.querySelector('.drawer__inner');
      if (inner && typeof trapFocus === 'function') {
        trapFocus(drawer, inner);
      }
    }

    function closeDrawer() {
      document.body.classList.remove('overflow-hidden', 'ai-summary-drawer-open');
      drawer.classList.remove('active');
      
      setTimeout(function () {
        drawer.setAttribute('hidden', '');
      }, 400);

      if (typeof removeTrapFocus === 'function') {
        removeTrapFocus(fab);
      }
    }

    // Toggle Language
    if (translateBtn) {
      translateBtn.addEventListener('click', function () {
        currentLang = currentLang === 'en' ? 'hi' : 'en';
        
        // Update Translate button text
        translateBtn.textContent = currentLang === 'en' ? t("Translate to Hindi", 'en') : t("Translate to English", 'hi');
        
        // Re-generate and re-render the summary
        var summary = generateProductSummary(productData, currentLang);
        renderSummary(root, summary, currentLang);
      });
    }

    fab.addEventListener('click', openDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('active')) {
        closeDrawer();
      }
    });

    fab.addEventListener('mouseenter', function () {
      if (tooltip) tooltip.classList.add('active');
    });
    fab.addEventListener('mouseleave', function () {
      if (tooltip) tooltip.classList.remove('active');
    });
    fab.addEventListener('click', function () {
      if (tooltip) tooltip.classList.remove('active');
    });

    window.generateProductSummary = generateProductSummary;

    // Run first generation
    var summary = generateProductSummary(productData, currentLang);
    renderSummary(root, summary, currentLang);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined' && PUB_SUB_EVENTS.variantChange) {
      subscribe(PUB_SUB_EVENTS.variantChange, function (event) {
        var detail = event && event.data ? event.data : null;
        if (!detail || !detail.variant) return;
        
        productData.selected_variant = detail.variant;
        var updatedSummary = generateProductSummary(productData, currentLang);
        renderSummary(root, updatedSummary, currentLang);
      });
    }

    document.addEventListener('change', function (evt) {
      var target = evt.target;
      if (!target) return;
      if (!target.closest('variant-selects')) return;

      var selectedVariantScript = document.querySelector('variant-selects [data-selected-variant]');
      if (!selectedVariantScript) return;

      try {
        var currentVariant = JSON.parse(selectedVariantScript.textContent || '{}');
        productData.selected_variant = currentVariant;
        var updatedSummary = generateProductSummary(productData, currentLang);
        renderSummary(root, updatedSummary, currentLang);
      } catch (error) {
        console.warn('AI summary variant parse failed', error);
      }
    });
  }

  function boot() {
    document.querySelectorAll('[data-ai-product-summary]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
