/* ── Recommendation Engine & UI Orchestration ───────────────── */

/* ── Helpers ────────────────────────────────────────────────── */

const formatMoney = (cents) => {
  const amount = Number(cents || 0) / 100;
  const currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'INR';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (error) {
    return 'Rs. ' + Math.round(amount).toLocaleString('en-IN');
  }
};

const cleanSpec = (text) => {
  if (!text) return 'Not specified';
  let val = text.trim();
  // Remove parentheses and details inside them
  if (val.includes('(')) {
    val = val.split('(')[0].trim();
  }
  // Remove comma details
  if (val.includes(',')) {
    val = val.split(',')[0].trim();
  }
  // Truncate if still too long
  if (val.length > 35) {
    val = val.substring(0, 32) + '...';
  }
  return val;
};

class RecommendationService {
  constructor(productsData) {
    this.products = productsData;
  }

  /**
   * Evaluates quiz answers and returns the top 3 recommended products.
   * @param {Object} answers { primaryUse: string, budget: string, brand: string, battery: string, portability: string }
   * @returns {Promise<Array>} Recommended item array
   */
  async getRecommendations(answers) {
    const scoredProducts = this.products.map(product => {
      const scoreResult = this.calculateScore(product, answers);
      return {
        product: product,
        variant: scoreResult.bestVariant,
        score: scoreResult.score,
        explanation: scoreResult.explanation,
        matchPercentage: Math.min(100, Math.max(0, Math.round(scoreResult.score)))
      };
    });

    // Filter out unavailable products or products with no available variants
    const availableRecommendations = scoredProducts.filter(item => {
      return item.product.available && item.variant && item.variant.available;
    });

    // Sort by score descending
    availableRecommendations.sort((a, b) => b.score - a.score);

    // Return top 3 distinct products
    return availableRecommendations.slice(0, 3);
  }

  /**
   * Calculates the score of a product based on customer answers.
   */
  calculateScore(product, answers) {
    let score = 0;
    const reasons = [];

    // 1. Budget Match (+40 points)
    // Check variants to find the one matching the budget range, prioritizing available variants
    let bestVariant = null;
    let budgetMatch = false;

    // Standardize budget limits
    let minBudget = 0;
    let maxBudget = Infinity;
    
    switch (answers.budget) {
      case '10k-15k':
        minBudget = 10000 * 100;
        maxBudget = 15000 * 100;
        break;
      case '15k-25k':
        minBudget = 15000 * 100;
        maxBudget = 25000 * 100;
        break;
      case '25k-30k':
        minBudget = 25000 * 100;
        maxBudget = 30000 * 100;
        break;
      case '30k+':
        minBudget = 30000 * 100;
        break;
    }

    // Evaluate variants
    const availableVariants = product.variants.filter(v => v.available);
    const candidateVariants = availableVariants.length > 0 ? availableVariants : product.variants;

    // Search for variant fitting the budget
    for (const variant of candidateVariants) {
      if (variant.price >= minBudget && variant.price <= maxBudget) {
        bestVariant = variant;
        budgetMatch = true;
        break;
      }
    }

    // Fallback if no variant matches the budget range
    if (!bestVariant) {
      // Find variant closest to the budget ceiling or just the cheapest one
      bestVariant = candidateVariants.reduce((cheapest, v) => {
        return (!cheapest || v.price < cheapest.price) ? v : cheapest;
      }, null);
    }

    let budgetDisplay = answers.budget;
    if (answers.budget === '10k-15k') budgetDisplay = '₹10,000 - ₹15,000';
    else if (answers.budget === '15k-25k') budgetDisplay = '₹15,000 - ₹25,000';
    else if (answers.budget === '25k-30k') budgetDisplay = '₹25,000 - ₹30,000';
    else if (answers.budget === '30k+') budgetDisplay = '₹30,000+';

    if (budgetMatch) {
      score += 40;
      reasons.push("fits your budget of " + budgetDisplay);
    }

    // 2. Use Case Match (+30 points)
    let useCaseMatch = false;
    const tagsString = (product.tags || []).join(' ').toLowerCase();
    const titleLower = (product.title || '').toLowerCase();
    const processorLower = (product.metafields.processor || '').toLowerCase();
    const graphicsLower = (product.metafields.graphics || '').toLowerCase();
    const ramOption = bestVariant ? (bestVariant.option1 || '').toLowerCase() : '';

    switch (answers.primaryUse) {
      case 'Study and Online Class':
        if (tagsString.includes('study') || tagsString.includes('student') || tagsString.includes('education') ||
            tagsString.includes('online class') ||
            (bestVariant && bestVariant.price < 25000 * 100) ||
            processorLower.includes('i3') || processorLower.includes('ryzen 3') || processorLower.includes('celeron') || processorLower.includes('pentium')) {
          useCaseMatch = true;
        }
        break;
      case 'Office Work':
        if (tagsString.includes('office') || tagsString.includes('business') || tagsString.includes('corporate') ||
            titleLower.includes('latitude') || titleLower.includes('thinkpad') || titleLower.includes('elitebook') ||
            processorLower.includes('i5') || processorLower.includes('ryzen 5') ||
            ramOption.includes('8gb') || ramOption.includes('16gb')) {
          useCaseMatch = true;
        }
        break;
      case 'Programming & Graphic Design':
        if (tagsString.includes('programming') || tagsString.includes('developer') || tagsString.includes('coding') ||
            tagsString.includes('design') || tagsString.includes('graphics') || tagsString.includes('photoshop') || tagsString.includes('illustrator') ||
            ramOption.includes('16gb') || ramOption.includes('32gb') ||
            processorLower.includes('i5') || processorLower.includes('i7') || processorLower.includes('ryzen 5') || processorLower.includes('ryzen 7') ||
            graphicsLower.includes('nvidia') || graphicsLower.includes('amd') || graphicsLower.includes('radeon') || graphicsLower.includes('rtx') || graphicsLower.includes('gtx') || graphicsLower.includes('quadro')) {
          useCaseMatch = true;
        }
        break;
      case 'Video Editing':
        if (tagsString.includes('video') || tagsString.includes('editing') || tagsString.includes('creator') ||
            ramOption.includes('16gb') || ramOption.includes('32gb') ||
            processorLower.includes('i7') || processorLower.includes('i9') || processorLower.includes('ryzen 7') || processorLower.includes('ryzen 9') ||
            graphicsLower.includes('nvidia') || graphicsLower.includes('amd') || graphicsLower.includes('radeon') || graphicsLower.includes('rtx') || graphicsLower.includes('gtx') || graphicsLower.includes('quadro')) {
          useCaseMatch = true;
        }
        break;
      case 'Light Gaming':
        if (tagsString.includes('gaming') || tagsString.includes('game') ||
            graphicsLower.includes('nvidia') || graphicsLower.includes('amd') || graphicsLower.includes('radeon') || graphicsLower.includes('iris') || graphicsLower.includes('rtx') || graphicsLower.includes('gtx')) {
          useCaseMatch = true;
        }
        break;
    }

    if (useCaseMatch) {
      score += 30;
      reasons.push("is optimized for " + answers.primaryUse.toLowerCase());
    }

    // 3. Preferred Brand Match (+10 points)
    let brandMatch = false;
    const vendorLower = (product.vendor || '').toLowerCase();

    if (answers.brand === 'No Preference') {
      brandMatch = true;
    } else {
      const matchBrand = answers.brand.toLowerCase();
      if (matchBrand === 'thinkpad') {
        if (titleLower.includes('thinkpad') || tagsString.includes('thinkpad') || vendorLower.includes('thinkpad')) {
          brandMatch = true;
        }
      } else if (vendorLower.includes(matchBrand) || titleLower.includes(matchBrand)) {
        brandMatch = true;
      }
    }

    if (brandMatch) {
      score += 10;
      if (answers.brand !== 'No Preference') {
        reasons.push("is your preferred brand (" + answers.brand + ")");
      }
    }

    // 4. Touch Screen Match (+15 points)
    let touchscreenMatch = false;
    const hasTouchScreen = titleLower.includes('touch') || tagsString.includes('touch') || tagsString.includes('touchscreen');

    if (answers.touchscreen === "Doesn't Matter") {
      touchscreenMatch = true;
      score += 15;
    } else if (answers.touchscreen === 'Yes') {
      if (hasTouchScreen) {
        touchscreenMatch = true;
        score += 15;
      }
    } else if (answers.touchscreen === 'No') {
      if (!hasTouchScreen) {
        touchscreenMatch = true;
        score += 15;
      }
    }

    if (touchscreenMatch && answers.touchscreen === 'Yes') {
      reasons.push("features a touchscreen display");
    }

    // 5. SSD (+5 points)
    let hasSSD = false;
    const storageOption = bestVariant ? (bestVariant.option2 || '').toLowerCase() : '';
    const storageVal = (product.metafields.storage || '').toLowerCase();

    if (storageOption.includes('ssd') || storageOption.includes('nvme') || 
        storageVal.includes('ssd') || storageVal.includes('nvme') ||
        tagsString.includes('ssd')) {
      hasSSD = true;
      score += 5;
      reasons.push("features high-speed SSD storage");
    }

    // Generate dynamic explanation sentence
    let explanation = "Recommended because it ";
    if (reasons.length > 1) {
      const last = reasons.pop();
      explanation += reasons.join(', ') + ' and ' + last + '.';
    } else if (reasons.length === 1) {
      explanation += reasons[0] + '.';
    } else {
      explanation = "Recommended because it matches your requirements for a reliable refurbished laptop.";
    }

    return {
      bestVariant: bestVariant,
      score: score,
      explanation: explanation
    };
  }
}

/* ── UI Controller ─────────────────────────────────────────── */

class LaptopAssistant {
  constructor() {
    this.currentStep = 1;
    this.answers = {
      primaryUse: '',
      budget: '',
      brand: '',
      touchscreen: ''
    };
    this.products = [];
    this.recommendationService = null;
    this.recommendations = []; // Calculated recommendations
    this.selectedCompare = []; // Selected product IDs for comparison

    this.initDOM();
    this.loadProductsData();
    this.bindEvents();
    this.updateStep();
    this.initTooltipCycle();
  }

  initDOM() {
    this.drawer = document.getElementById('LaptopAssistantDrawer');
    this.overlay = document.getElementById('LaptopAssistantDrawer-Overlay');
    this.closeBtn = document.getElementById('LaptopAssistantClose');
    this.fab = document.getElementById('LaptopAssistantFAB');
    this.tooltip = document.getElementById('LaptopAssistantFABTooltip');
    this.tooltipText = document.getElementById('LaptopAssistantFABTooltipText');
    
    this.steps = Array.from(document.querySelectorAll('.laptop-assistant-step'));
    this.progressBar = document.getElementById('LaptopAssistantProgressBar');

    this.drawerTitle = document.getElementById('LaptopAssistantTitle');
    this.drawerSubtitle = document.getElementById('LaptopAssistantSubtitle');
    this.initialTitle = this.drawerTitle ? this.drawerTitle.textContent : 'Laptop Finder';
    this.initialSubtitle = this.drawerSubtitle ? this.drawerSubtitle.textContent : '';
    
    this.prevBtn = document.getElementById('LaptopAssistantPrev');
    this.nextBtn = document.getElementById('LaptopAssistantNext');
    this.restartBtn = document.getElementById('LaptopAssistantRestart');
    this.compareCtaBtn = document.getElementById('LaptopAssistantCompareCTA');
    this.compareAllBtn = document.getElementById('LaptopAssistantCompareAll'); // Added Compare All
    this.backToResultsBtn = document.getElementById('LaptopAssistantBackToResults');

    this.quizFooter = document.getElementById('LaptopAssistantFooterQuiz');
    this.resultsFooter = document.getElementById('LaptopAssistantFooterResults');
    this.compareFooter = document.getElementById('LaptopAssistantFooterComparison');

    this.resultsArea = document.getElementById('LaptopAssistantResults');
    this.resultsList = document.getElementById('LaptopAssistantRecommendationsList');
    this.comparisonArea = document.getElementById('LaptopAssistantComparison');

    // Fullscreen Comparison Modal elements
    this.compModal = document.getElementById('LaptopAssistantComparisonModal');
    this.closeCompModalBtn = document.getElementById('LaptopAssistantCloseComparisonModal');
    this.compModalTable = document.getElementById('LaptopAssistantComparisonModalTable');
  }

  initTooltipCycle() {
    if (!this.tooltip || !this.tooltipText) return;

    const phrases = [
      "Try Us",
      "Laptop Finder",
      "Find Laptop",
      "Get Help",
      "Compare Laptops"
    ];
    let currentIndex = 0;

    const cycle = () => {
      this.tooltipText.textContent = phrases[currentIndex];
      this.tooltip.classList.add('active');

      setTimeout(() => {
        this.tooltip.classList.remove('active');
        setTimeout(() => {
          currentIndex = (currentIndex + 1) % phrases.length;
          cycle();
        }, 1000);
      }, 4500);
    };

    setTimeout(cycle, 1500);
  }

  loadProductsData() {
    try {
      const dataEl = document.getElementById('laptop-assistant-products-data');
      if (dataEl) {
        this.products = JSON.parse(dataEl.textContent || '[]');
        this.recommendationService = new RecommendationService(this.products);
      }
    } catch (e) {
      console.error('Error loading products data for laptop assistant', e);
    }
  }

  bindEvents() {
    // Open/Close
    if (this.fab) this.fab.addEventListener('click', () => this.open());
    if (this.tooltip) this.tooltip.addEventListener('click', () => this.open());
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.overlay) this.overlay.addEventListener('click', () => this.close());

    // Esc close
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        if (this.compModal && !this.compModal.hasAttribute('hidden')) {
          this.closeComparisonModal();
        } else if (this.drawer && !this.drawer.hasAttribute('hidden')) {
          this.close();
        }
      }
    });

    // Quiz Navigation
    if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.nextStep());
    if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prevStep());
    if (this.restartBtn) this.restartBtn.addEventListener('click', () => this.restartQuiz());
    if (this.backToResultsBtn) this.backToResultsBtn.addEventListener('click', () => this.showResultsList());
    
    // Compare Selected CTA Click
    if (this.compareCtaBtn) {
      this.compareCtaBtn.addEventListener('click', () => {
        const selectedItems = this.recommendations.filter(item => this.selectedCompare.includes(item.product.id));
        this.showComparisonModal(selectedItems);
      });
    }

    // Compare All Click
    if (this.compareAllBtn) {
      this.compareAllBtn.addEventListener('click', () => {
        this.showComparisonModal(this.recommendations);
      });
    }

    // Close Comparison Modal
    if (this.closeCompModalBtn) {
      this.closeCompModalBtn.addEventListener('click', () => this.closeComparisonModal());
    }

    // Option selections
    document.querySelectorAll('.laptop-assistant-radio').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const stepNum = parseInt(e.target.closest('.laptop-assistant-step').dataset.step);
        const name = e.target.name;
        this.answers[name] = e.target.value;
        this.nextBtn.removeAttribute('disabled');
        
        // Auto-advance to the next step after a short delay for visual selection feedback
        setTimeout(() => {
          if (this.currentStep === stepNum) {
            this.nextStep();
          }
        }, 300);
      });
    });
  }

  open() {
    if (!this.drawer) return;
    
    // If they already completed the quiz and are viewing results, restart fresh on open!
    if (this.currentStep > 4 || (this.resultsArea && !this.resultsArea.hasAttribute('hidden'))) {
      this.restartQuiz();
    }
    
    // Hide WhatsApp widget and prevent background scrolling
    document.body.classList.add('overflow-hidden', 'laptop-assistant-open');
    
    this.drawer.removeAttribute('hidden');
    this.drawer.offsetHeight; // Force reflow to run the transition cleanly
    
    this.drawer.classList.add('animate', 'active');
    const inner = this.drawer.querySelector('.drawer__inner');
    if (inner) trapFocus(this.drawer, inner);
  }

  close() {
    if (!this.drawer) return;
    
    // Show WhatsApp widget again and enable page scroll
    document.body.classList.remove('overflow-hidden', 'laptop-assistant-open');
    
    this.drawer.classList.remove('active');
    setTimeout(() => {
      this.drawer.setAttribute('hidden', '');
    }, 400); // Transition duration
    removeTrapFocus(this.fab);
  }

  updateStep() {
    // Hide all steps, results, and comparison
    this.steps.forEach(step => step.setAttribute('hidden', ''));
    if (this.resultsArea) this.resultsArea.setAttribute('hidden', '');
    if (this.comparisonArea) this.comparisonArea.setAttribute('hidden', '');

    // Footers
    if (this.quizFooter) this.quizFooter.removeAttribute('hidden');
    if (this.resultsFooter) this.resultsFooter.setAttribute('hidden', '');
    if (this.compareFooter) this.compareFooter.setAttribute('hidden', '');

    // Show current step
    const currentStepContainer = this.steps.find(step => parseInt(step.dataset.step) === this.currentStep);
    if (currentStepContainer) {
      currentStepContainer.removeAttribute('hidden');
    }

    // Update Progress Bar
    const progressPercent = ((this.currentStep - 1) / 3) * 100;
    if (this.progressBar) {
      this.progressBar.style.width = `${progressPercent}%`;
    }

    // Dynamic Heading update
    if (this.drawerTitle) this.drawerTitle.textContent = this.initialTitle;
    if (this.drawerSubtitle) this.drawerSubtitle.textContent = `Step ${this.currentStep} of 4`;

    // Back button state
    if (this.currentStep === 1) {
      this.prevBtn.setAttribute('disabled', 'true');
    } else {
      this.prevBtn.removeAttribute('disabled');
    }

    // Next button state (disabled until answer selected)
    const activeStepInput = currentStepContainer ? currentStepContainer.querySelector('input[type="radio"]:checked') : null;
    if (activeStepInput) {
      this.nextBtn.removeAttribute('disabled');
    } else {
      this.nextBtn.setAttribute('disabled', 'true');
    }
  }

  nextStep() {
    if (this.currentStep < 4) {
      this.currentStep++;
      this.updateStep();
    } else {
      // Completed last step! Compute recommendations.
      this.calculateRecommendations();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStep();
    }
  }

  async calculateRecommendations() {
    if (!this.recommendationService) return;
    
    // Hide quiz steps & progress
    this.steps.forEach(step => step.setAttribute('hidden', ''));
    const progress = document.getElementById('LaptopAssistantProgress');
    if (progress) progress.style.display = 'none';

    // Fetch recommendations
    this.recommendations = await this.recommendationService.getRecommendations(this.answers);
    this.renderRecommendations();

    // Dynamic Heading update for Results
    if (this.drawerTitle) this.drawerTitle.textContent = 'Your Recommendations';
    if (this.drawerSubtitle) this.drawerSubtitle.textContent = 'Based on your preferences';

    // Show Results Panel
    if (this.resultsArea) this.resultsArea.removeAttribute('hidden');

    // Toggle Footers
    if (this.quizFooter) this.quizFooter.setAttribute('hidden', '');
    if (this.resultsFooter) this.resultsFooter.removeAttribute('hidden');
    if (this.compareFooter) this.compareFooter.setAttribute('hidden', '');
    
    this.selectedCompare = [];
    this.updateCompareButton();
  }

  renderRecommendations() {
    if (!this.resultsList) return;

    if (this.recommendations.length === 0) {
      this.resultsList.innerHTML = `
        <div class="center" style="padding: 3rem 1rem; text-align: center;">
          <p style="font-size: 1.4rem; color: #6b7280;">No refurbished laptops matching your search filters are currently in stock. Please try restarting and adjusting your filters!</p>
        </div>
      `;
      return;
    }

    this.resultsList.innerHTML = this.recommendations.map(item => {
      const p = item.product;
      const v = item.variant;
      const minPrice = p.variants && p.variants.length > 0 
        ? Math.min(...p.variants.map(varItem => varItem.price)) 
        : p.price;

      return `
        <div class="laptop-assistant-card" data-product-id="${p.id}">
          <div class="laptop-assistant-card__badge-row">
            <span class="laptop-assistant-card__match-badge">${item.matchPercentage}% Match</span>
            <label class="laptop-assistant-card__compare-checkbox">
              <input type="checkbox" class="laptop-assistant-compare-cb" value="${p.id}">
              <span>Compare</span>
            </label>
          </div>
          
          <a href="${p.url}?variant=${v.id}" target="_blank" class="laptop-assistant-card__main" style="text-decoration: none; color: inherit; display: flex; width: 100%;">
            <div class="laptop-assistant-card__img-wrap">
              <img src="${p.featured_image}" alt="${p.title}" loading="lazy">
            </div>
            <div class="laptop-assistant-card__info">
              <h4 class="laptop-assistant-card__title">${p.title}</h4>
              <div class="laptop-assistant-card__prices">
                <span class="laptop-assistant-card__price">Starting at ${formatMoney(minPrice)}</span>
              </div>
            </div>
          </a>

          <div class="laptop-assistant-card__actions">
            <a href="${p.url}?variant=${v.id}" target="_blank" class="laptop-assistant-card__btn is-secondary">View Details</a>
            <button type="button" class="laptop-assistant-card__btn is-primary laptop-assistant-add-to-cart-btn" data-variant-id="${v.id}">Add to Cart</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach ATC event listeners
    this.resultsList.querySelectorAll('.laptop-assistant-add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const variantId = e.target.dataset.variantId;
        this.addToCart(variantId, e.target);
      });
    });

    // Attach compare checkbox listeners
    this.resultsList.querySelectorAll('.laptop-assistant-compare-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const productId = parseInt(e.target.value);
        if (e.target.checked) {
          if (this.selectedCompare.length >= 3) {
            e.target.checked = false;
            alert('You can compare a maximum of 3 laptops.');
            return;
          }
          this.selectedCompare.push(productId);
        } else {
          this.selectedCompare = this.selectedCompare.filter(id => id !== productId);
        }
        this.updateCompareButton();
      });
    });
  }

  updateCompareButton() {
    if (!this.compareCtaBtn) return;
    
    const count = this.selectedCompare.length;
    this.compareCtaBtn.textContent = `Compare (${count} selected)`;

    if (count >= 2 && count <= 3) {
      this.compareCtaBtn.removeAttribute('disabled');
    } else {
      this.compareCtaBtn.setAttribute('disabled', 'true');
    }
  }

  addToCart(variantId, button) {
    button.setAttribute('disabled', 'true');
    const originalText = button.textContent;
    button.textContent = 'Adding...';

    const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    const sections = cart ? cart.getSectionsToRender().map(s => s.id) : ['cart-icon-bubble'];

    const formData = {
      id: variantId,
      quantity: 1,
      sections: sections,
      sections_url: window.location.pathname
    };

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(formData)
    })
    .then(response => {
      if (!response.ok) throw new Error('Network response error adding to cart');
      return response.json();
    })
    .then(response => {
      // Close recommendation drawer first
      this.close();
      this.closeComparisonModal();

      // Render updated contents in theme cart-drawer or cart-notification
      if (cart) {
        cart.renderContents(response);
      } else {
        // Fallback: update bubble manually
        const cartIconBubble = document.getElementById('cart-icon-bubble');
        const sectionHtml = response.sections && response.sections['cart-icon-bubble'];
        if (cartIconBubble && sectionHtml) {
          cartIconBubble.innerHTML = new DOMParser()
            .parseFromString(sectionHtml, 'text/html')
            .querySelector('.shopify-section').innerHTML;
        }
      }
    })
    .catch(err => {
      console.error('Error adding variant to cart via recommendation assistant', err);
      alert('Could not add laptop to cart. Please try opening the product page.');
    })
    .finally(() => {
      button.removeAttribute('disabled');
      button.textContent = originalText;
    });
  }

  showComparisonModal(items) {
    if (!this.compModal || !this.compModalTable) return;
    
    this.compModal.removeAttribute('hidden');
    this.compModal.offsetHeight; // Force reflow to run the transition cleanly
    this.compModal.classList.add('active');

    const getSpecVal = (item, key) => {
      if (key === 'price') return formatMoney(item.variant.price);
      if (key === 'ram') {
        if (item.product.metafields && item.product.metafields.ram) {
          return cleanSpec(item.product.metafields.ram);
        }
        const rams = [];
        if (item.product.variants && item.product.variants.length > 0) {
          item.product.variants.forEach(variant => {
            const ramRaw = variant.option1;
            if (ramRaw) {
              const match = ramRaw.match(/(\d+)\s*(?:GB|gb)?/i);
              if (match) {
                const num = parseInt(match[1]);
                if (!rams.includes(num)) {
                  rams.push(num);
                }
              } else {
                const cleaned = cleanSpec(ramRaw);
                if (cleaned && !rams.includes(cleaned)) {
                  rams.push(cleaned);
                }
              }
            }
          });
        }
        rams.sort((a, b) => {
          const numA = parseInt(a);
          const numB = parseInt(b);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return String(a).localeCompare(String(b));
        });
        if (rams.length > 0) {
          const formatted = rams.map(r => typeof r === 'number' ? `${r}GB` : r);
          return formatted.join(' / ') + ' available';
        }
        return 'Not specified';
      }
      if (key === 'storage') {
        if (item.product.metafields && item.product.metafields.storage) {
          return cleanSpec(item.product.metafields.storage);
        }
        const storages = [];
        if (item.product.variants && item.product.variants.length > 0) {
          item.product.variants.forEach(variant => {
            const storageRaw = variant.option2;
            if (storageRaw) {
              const cleaned = cleanSpec(storageRaw);
              if (cleaned && !storages.includes(cleaned)) {
                storages.push(cleaned);
              }
            }
          });
        }
        storages.sort((a, b) => {
          const numA = parseInt(a);
          const numB = parseInt(b);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return String(a).localeCompare(String(b));
        });
        if (storages.length > 0) {
          return storages.join(' / ') + ' available';
        }
        return 'Not specified';
      }
      return cleanSpec(item.product.metafields[key]) || 'Not specified';
    };

    const colsHtml = items.map(item => {
      const p = item.product;
      const v = item.variant;
      return `
        <td>
          <div class="laptop-assistant-comparison__th-card">
            <a href="${p.url}?variant=${v.id}" target="_blank" style="display: flex; flex-direction: column; gap: 0.6rem; align-items: inherit; width: 100%; text-decoration: none; color: inherit;">
              <img src="${p.featured_image}" alt="${p.title}" loading="lazy">
              <span class="laptop-assistant-comparison__th-title">${p.title}</span>
            </a>
            <span class="laptop-assistant-comparison__th-price" style="font-size: 1.6rem; color: #16346a; font-weight: 700; margin: 0.2rem 0 0.8rem;">${formatMoney(v.price)}</span>
            <div class="laptop-assistant-comparison__th-actions" style="display: flex; flex-direction: column; gap: 0.8rem; width: 100%;">
              <a href="${p.url}?variant=${v.id}" target="_blank" class="laptop-assistant-card__btn is-secondary" style="width: 100%; text-decoration: none; text-align: center;">See Product</a>
              <button type="button" class="laptop-assistant-card__btn is-primary modal-add-to-cart-btn" data-variant-id="${v.id}" style="width: 100%;">Add to Cart</button>
            </div>
          </div>
        </td>
      `;
    }).join('');

    const rows = [
      { label: 'Processor', key: 'processor' },
      { label: 'Generation', key: 'generation' },
      { label: 'RAM', key: 'ram' },
      { label: 'Storage', key: 'storage' },
      { label: 'Display size', key: 'display' },
      { label: 'Warranty', key: 'warranty' },
      { label: 'Price', key: 'price' }
    ];

    const tbodyHtml = rows.map(row => {
      const cells = items.map(item => `<td>${getSpecVal(item, row.key)}</td>`).join('');
      return `
        <tr>
          <th>${row.label}</th>
          ${cells}
        </tr>
      `;
    }).join('');

    this.compModalTable.innerHTML = `
      <div class="laptop-assistant-comparison__table-wrapper">
        <table class="laptop-assistant-comparison__table">
          <thead>
            <tr>
              <th style="width: 180px; min-width: 130px;">Specifications</th>
              ${colsHtml}
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;

    // Bind ATC buttons inside the modal
    this.compModalTable.querySelectorAll('.modal-add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const varId = btn.dataset.variantId;
        this.addToCart(varId, btn);
      });
    });
  }

  closeComparisonModal() {
    if (!this.compModal) return;
    this.compModal.classList.remove('active');
    setTimeout(() => {
      this.compModal.setAttribute('hidden', '');
    }, 400);
  }


  showResultsList() {
    if (this.resultsArea) this.resultsArea.removeAttribute('hidden');
    if (this.comparisonArea) this.comparisonArea.setAttribute('hidden', '');

    // Reset footers
    if (this.quizFooter) this.quizFooter.setAttribute('hidden', '');
    if (this.resultsFooter) this.resultsFooter.removeAttribute('hidden');
    if (this.compareFooter) this.compareFooter.setAttribute('hidden', '');
  }

  restartQuiz() {
    this.currentStep = 1;
    this.answers = {
      primaryUse: '',
      budget: '',
      brand: '',
      touchscreen: ''
    };
    this.selectedCompare = [];
    
    // Reset radio inputs
    document.querySelectorAll('.laptop-assistant-radio').forEach(radio => {
      radio.checked = false;
    });

    const progress = document.getElementById('LaptopAssistantProgress');
    if (progress) progress.style.display = 'block';

    this.updateStep();
  }
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.laptopAssistant = new LaptopAssistant();
});
