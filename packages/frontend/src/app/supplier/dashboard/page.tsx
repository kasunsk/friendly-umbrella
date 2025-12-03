'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPost, apiGet, apiPut, apiDelete } from '@/lib/api';
import { getTenantStatistics } from '@/lib/tenantAdminApi';
import Link from 'next/link';

export default function SupplierDashboardPage() {
  return (
    <ProtectedRoute requireTenantType="supplier">
      <DashboardContent />
    </ProtectedRoute>
  );
}

interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  productsWithPrices: number;
  productsWithPrivatePrices: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  isActive: boolean;
  defaultPrices: Array<{
    id: string;
    price: number;
    currency: string;
    isActive: boolean;
  }>;
  _count: {
    privatePrices: number;
  };
}

type FilterType = 'all' | 'active' | 'withPrices' | 'withPrivatePrices' | null;

function DashboardContent() {
  const { user, logout } = useAuth();
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState<ProductStats>({
    totalProducts: 0,
    activeProducts: 0,
    productsWithPrices: 0,
    productsWithPrivatePrices: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const productsPerPage = 10;
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit: '',
    defaultPrice: '',
    currency: 'USD',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pendingUserCount, setPendingUserCount] = useState<number>(0);
  
  // Special prices for new product
  interface SpecialPriceEntry {
    id: string; // temporary id for React key
    companyId: string;
    companyName?: string; // For display in table
    priceType: 'price' | 'discount'; // 'price' for fixed price, 'discount' for discount percentage
    price: string;
    discountPercentage: string;
    currency: string;
    notes: string;
  }
  
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [draftSpecialPrice, setDraftSpecialPrice] = useState<SpecialPriceEntry | null>(null);
  const [includedSpecialPrices, setIncludedSpecialPrices] = useState<SpecialPriceEntry[]>([]);
  const [editingSpecialPriceId, setEditingSpecialPriceId] = useState<string | null>(null);
  
  // Edit modal special prices (using same draft/included pattern)
  const [editDraftSpecialPrice, setEditDraftSpecialPrice] = useState<SpecialPriceEntry | null>(null);
  const [editIncludedSpecialPrices, setEditIncludedSpecialPrices] = useState<SpecialPriceEntry[]>([]);
  const [editingEditSpecialPriceId, setEditingEditSpecialPriceId] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const data = await apiGet<ProductStats>('/api/v1/products/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch pending user count for admin users
  const fetchPendingUserCount = async () => {
    if (user?.role !== 'supplier_admin') {
      return;
    }
    
    try {
      const stats = await getTenantStatistics();
      setPendingUserCount(stats.users.pending || 0);
    } catch (err) {
      console.error('Failed to fetch pending user count:', err);
      setPendingUserCount(0);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPendingUserCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh pending user count when user changes or when returning to dashboard
  useEffect(() => {
    if (user?.role === 'supplier_admin') {
      fetchPendingUserCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const fetchProducts = async (filter: FilterType, page = 1) => {
    if (!filter) {
      setProducts([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalProducts(0);
      return;
    }

    setIsLoadingProducts(true);
    try {
      let endpoint = '/api/v1/products';
      const params = new URLSearchParams();

      if (filter === 'all') {
        params.append('includeInactive', 'true');
      } else if (filter === 'active') {
        params.append('includeInactive', 'false');
      }

      // Add pagination parameters
      params.append('page', page.toString());
      params.append('limit', productsPerPage.toString());

      const response = await apiGet<{ products: Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        `${endpoint}${params.toString() ? `?${params.toString()}` : ''}`
      );

      let filteredProducts = response.products;

      // Filter client-side for more complex filters
      if (filter === 'withPrices') {
        filteredProducts = response.products.filter(
          (p) => p.defaultPrices && p.defaultPrices.length > 0 && p.defaultPrices[0].isActive
        );
      } else if (filter === 'withPrivatePrices') {
        filteredProducts = response.products.filter(
          (p) => p._count.privatePrices > 0
        );
      }

      setProducts(filteredProducts);
      setCurrentPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotalProducts(response.pagination.total);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setProducts([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalProducts(0);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleCardClick = (filter: FilterType) => {
    if (activeFilter === filter) {
      // If clicking the same card, close the list
      setActiveFilter(null);
      setProducts([]);
      setSearchQuery('');
      setCurrentPage(1);
      setTotalPages(1);
      setTotalProducts(0);
    } else {
      // Reset to first page when changing filter
      setCurrentPage(1);
      setSearchQuery(''); // Clear search when changing filter
      setActiveFilter(filter);
      fetchProducts(filter, 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  // Load companies when modal opens
  useEffect(() => {
    if (showAddProductModal || showEditProductModal) {
      loadCompanies();
    }
  }, [showAddProductModal, showEditProductModal]);

  const loadCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const response = await apiGet<{ companies: Array<{ id: string; name: string; email: string }> }>('/api/v1/companies');
      setCompanies(response.companies || []);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
      setError('Failed to load companies list');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleAddSpecialPrice = () => {
    const newEntry: SpecialPriceEntry = {
      id: `draft-${Date.now()}-${Math.random()}`,
      companyId: '',
      priceType: 'price', // Default to price
      price: '',
      discountPercentage: '',
      currency: formData.currency || 'USD',
      notes: '',
    };
    setDraftSpecialPrice(newEntry);
    setEditingSpecialPriceId(null);
  };

  const handleIncludeSpecialPrice = () => {
    if (!draftSpecialPrice) return;
    
    // Validate draft
    if (!draftSpecialPrice.companyId) {
      setError('Please select a company');
      return;
    }
    
    if (draftSpecialPrice.priceType === 'price') {
      if (!draftSpecialPrice.price || parseFloat(draftSpecialPrice.price) <= 0) {
        setError('Please enter a valid special price');
        return;
      }
    } else {
      if (!draftSpecialPrice.discountPercentage || 
          parseFloat(draftSpecialPrice.discountPercentage) < 0 || 
          parseFloat(draftSpecialPrice.discountPercentage) > 100) {
        setError('Please enter a valid discount percentage (0-100)');
        return;
      }
    }
    
    // Check if company already exists in included prices
    const existingIndex = includedSpecialPrices.findIndex(sp => sp.companyId === draftSpecialPrice.companyId);
    if (existingIndex >= 0) {
      setError('This company already has a special price. Please edit or remove it first.');
      return;
    }
    
    // Get company name for display
    const company = companies.find(c => c.id === draftSpecialPrice.companyId);
    
    // Move draft to included prices
    const includedEntry: SpecialPriceEntry = {
      ...draftSpecialPrice,
      id: `included-${Date.now()}-${Math.random()}`,
      companyName: company?.name || '',
    };
    
    setIncludedSpecialPrices([...includedSpecialPrices, includedEntry]);
    setDraftSpecialPrice(null);
    setError(null);
  };

  const handleEditSpecialPrice = (id: string) => {
    const entry = includedSpecialPrices.find(sp => sp.id === id);
    if (entry) {
      setDraftSpecialPrice({ ...entry });
      setEditingSpecialPriceId(id);
      setIncludedSpecialPrices(includedSpecialPrices.filter(sp => sp.id !== id));
    }
  };

  const handleRemoveSpecialPrice = (id: string) => {
    setIncludedSpecialPrices(includedSpecialPrices.filter(sp => sp.id !== id));
  };

  const handleCancelDraft = () => {
    setDraftSpecialPrice(null);
    setEditingSpecialPriceId(null);
    setError(null);
  };

  const handleDraftChange = (field: keyof SpecialPriceEntry, value: string) => {
    if (!draftSpecialPrice) return;
    
    setDraftSpecialPrice({ ...draftSpecialPrice, [field]: value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      // Validate and prepare special prices (only included ones)
      const validSpecialPrices = includedSpecialPrices
        .map(sp => {
          if (sp.priceType === 'price') {
            // For fixed price: send price and currency, ensure discountPercentage is not sent
            return {
              companyId: sp.companyId,
              price: parseFloat(sp.price),
              currency: sp.currency || formData.currency || 'USD',
              discountPercentage: undefined, // Explicitly exclude discount
              notes: sp.notes || undefined,
            };
          } else {
            // For discount percentage: send discountPercentage only, ensure price is not sent
            return {
              companyId: sp.companyId,
              price: undefined, // Explicitly exclude price
              discountPercentage: parseFloat(sp.discountPercentage),
              // Don't include currency for discount percentage - it will use product default currency
              notes: sp.notes || undefined,
            };
          }
        });

      const payload = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        unit: formData.unit,
        defaultPrice: formData.defaultPrice ? parseFloat(formData.defaultPrice) : undefined,
        currency: formData.currency,
        specialPrices: validSpecialPrices.length > 0 ? validSpecialPrices : undefined,
      };

      await apiPost('/api/v1/products', payload);
      setSuccess(true);
      setFormData({
        sku: '',
        name: '',
        description: '',
        category: '',
        unit: '',
        defaultPrice: '',
        currency: 'USD',
      });
      setIncludedSpecialPrices([]);
      setDraftSpecialPrice(null);
      setEditingSpecialPriceId(null);
      
      // Refresh stats after product creation
      await fetchStats();
      
      // Refresh product list if a filter is active
      if (activeFilter) {
        await fetchProducts(activeFilter, currentPage);
      }
      
      // Close modal after 1 second
      setTimeout(() => {
        setShowAddProductModal(false);
        setSuccess(false);
      }, 1000);
    } catch (err: any) {
      setError(err?.error?.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setShowAddProductModal(false);
      setShowEditProductModal(false);
      setEditingProduct(null);
      setError(null);
      setSuccess(false);
      setFormData({
        sku: '',
        name: '',
        description: '',
        category: '',
        unit: '',
        defaultPrice: '',
        currency: 'USD',
      });
      setIncludedSpecialPrices([]);
      setDraftSpecialPrice(null);
      setEditingSpecialPriceId(null);
      setEditIncludedSpecialPrices([]);
      setEditDraftSpecialPrice(null);
      setEditingEditSpecialPriceId(null);
    }
  };
  
  const handleAddEditSpecialPrice = () => {
    const newEntry: SpecialPriceEntry = {
      id: `edit-draft-${Date.now()}-${Math.random()}`,
      companyId: '',
      priceType: 'price',
      price: '',
      discountPercentage: '',
      currency: formData.currency || 'USD',
      notes: '',
    };
    setEditDraftSpecialPrice(newEntry);
    setEditingEditSpecialPriceId(null);
  };

  const handleIncludeEditSpecialPrice = () => {
    if (!editDraftSpecialPrice) return;
    
    // Validate draft
    if (!editDraftSpecialPrice.companyId) {
      setError('Please select a company');
      return;
    }
    
    if (editDraftSpecialPrice.priceType === 'price') {
      if (!editDraftSpecialPrice.price || parseFloat(editDraftSpecialPrice.price) <= 0) {
        setError('Please enter a valid special price');
        return;
      }
    } else {
      if (!editDraftSpecialPrice.discountPercentage || 
          parseFloat(editDraftSpecialPrice.discountPercentage) < 0 || 
          parseFloat(editDraftSpecialPrice.discountPercentage) > 100) {
        setError('Please enter a valid discount percentage (0-100)');
        return;
      }
    }
    
    // Check if company already exists in included prices
    const existingIndex = editIncludedSpecialPrices.findIndex(sp => sp.companyId === editDraftSpecialPrice.companyId);
    if (existingIndex >= 0 && editIncludedSpecialPrices[existingIndex].id !== editingEditSpecialPriceId) {
      setError('This company already has a special price. Please edit or remove it first.');
      return;
    }
    
    // Get company name for display
    const company = companies.find(c => c.id === editDraftSpecialPrice.companyId);
    
    // Move draft to included prices
    const includedEntry: SpecialPriceEntry = {
      ...editDraftSpecialPrice,
      id: editingEditSpecialPriceId || `edit-included-${Date.now()}-${Math.random()}`,
      companyName: company?.name || '',
    };
    
    if (editingEditSpecialPriceId) {
      // Update existing entry
      setEditIncludedSpecialPrices(editIncludedSpecialPrices.map(sp => 
        sp.id === editingEditSpecialPriceId ? includedEntry : sp
      ));
    } else {
      // Add new entry
      setEditIncludedSpecialPrices([...editIncludedSpecialPrices, includedEntry]);
    }
    
    setEditDraftSpecialPrice(null);
    setEditingEditSpecialPriceId(null);
    setError(null);
  };

  const handleEditEditSpecialPrice = (id: string) => {
    const entry = editIncludedSpecialPrices.find(sp => sp.id === id);
    if (entry) {
      setEditDraftSpecialPrice({ ...entry });
      setEditingEditSpecialPriceId(id);
    }
  };

  const handleRemoveEditSpecialPrice = (id: string) => {
    setEditIncludedSpecialPrices(editIncludedSpecialPrices.filter(sp => sp.id !== id));
  };

  const handleCancelEditDraft = () => {
    setEditDraftSpecialPrice(null);
    setEditingEditSpecialPriceId(null);
    setError(null);
  };

  const handleEditDraftChange = (field: keyof SpecialPriceEntry, value: string) => {
    if (!editDraftSpecialPrice) return;
    
    setEditDraftSpecialPrice({ ...editDraftSpecialPrice, [field]: value });
    setError(null);
  };

  const handleEditProduct = async (product: Product) => {
    try {
      // Fetch full product data with private prices
      const response = await apiGet<{ product: any }>(`/api/v1/products/${product.id}`);
      const fullProduct = response.product;
      
      setEditingProduct(fullProduct);
      setFormData({
        sku: fullProduct.sku,
        name: fullProduct.name,
        description: fullProduct.description || '',
        category: fullProduct.category || '',
        unit: fullProduct.unit,
        defaultPrice: fullProduct.defaultPrices && fullProduct.defaultPrices.length > 0 
          ? fullProduct.defaultPrices[0].price.toString() 
          : '',
        currency: fullProduct.defaultPrices && fullProduct.defaultPrices.length > 0
          ? fullProduct.defaultPrices[0].currency
          : 'USD',
      });
      
      // Load existing private prices into edit included special prices state
      if (fullProduct.privatePrices && fullProduct.privatePrices.length > 0) {
        // Get company names from loaded companies list
        const existingSpecialPrices: SpecialPriceEntry[] = fullProduct.privatePrices.map((pp: any) => {
          const companyInfo = companies.find(c => c.id === pp.companyId);
          // Determine pricing type: discountPercentage takes precedence if both exist
          const pricingType = (pp.discountPercentage !== null && pp.discountPercentage !== undefined) 
            ? 'discount' 
            : 'price';
          return {
            id: pp.id,
            companyId: pp.companyId,
            companyName: companyInfo?.name || 'Unknown',
            priceType: pricingType,
            // Only populate the field that matches the pricing type
            price: pricingType === 'price' && pp.price !== null && pp.price !== undefined 
              ? pp.price.toString() 
              : '',
            discountPercentage: pricingType === 'discount' && pp.discountPercentage !== null && pp.discountPercentage !== undefined 
              ? pp.discountPercentage.toString() 
              : '',
            currency: pricingType === 'price' ? (pp.currency || 'USD') : 'USD',
            notes: pp.notes || '',
          };
        });
        setEditIncludedSpecialPrices(existingSpecialPrices);
      } else {
        setEditIncludedSpecialPrices([]);
      }
      setEditDraftSpecialPrice(null);
      setEditingEditSpecialPriceId(null);
      
      setShowEditProductModal(true);
      setError(null);
      setSuccess(false);
    } catch (err: any) {
      console.error('Failed to fetch product details:', err);
      setError('Failed to load product details');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      // Validate and prepare special prices for edit (only included ones)
      const validSpecialPrices = editIncludedSpecialPrices
        .map(sp => {
          if (sp.priceType === 'price') {
            // For fixed price: send price and currency, ensure discountPercentage is not sent
            return {
              companyId: sp.companyId,
              price: parseFloat(sp.price),
              currency: sp.currency || formData.currency || 'USD',
              discountPercentage: undefined, // Explicitly exclude discount
              notes: sp.notes || undefined,
            };
          } else {
            // For discount percentage: send discountPercentage only, ensure price is not sent
            return {
              companyId: sp.companyId,
              price: undefined, // Explicitly exclude price
              discountPercentage: parseFloat(sp.discountPercentage),
              notes: sp.notes || undefined,
            };
          }
        });

      const payload: any = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        unit: formData.unit,
        specialPrices: validSpecialPrices.length > 0 ? validSpecialPrices : undefined,
      };

      // Only include price if it's provided
      if (formData.defaultPrice) {
        payload.defaultPrice = parseFloat(formData.defaultPrice);
        payload.currency = formData.currency;
      }

      await apiPut(`/api/v1/products/${editingProduct.id}`, payload);
      setSuccess(true);

      // Refresh stats and products
      await fetchStats();
      if (activeFilter) {
        await fetchProducts(activeFilter, currentPage);
      }

      setTimeout(() => {
        setShowEditProductModal(false);
        setEditingProduct(null);
        setEditSpecialPrices([]);
        setSuccess(false);
        setFormData({
          sku: '',
          name: '',
          description: '',
          category: '',
          unit: '',
          defaultPrice: '',
          currency: 'USD',
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.error?.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleInactive = async (product: Product) => {
    const newStatus = !product.isActive;
    
    // Store previous state for rollback on error
    const previousProducts = [...products];
    
    // Optimistically update UI immediately
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, isActive: newStatus } : p
      )
    );

    try {
      await apiPut(`/api/v1/products/${product.id}`, {
        isActive: newStatus,
      });

      // Refresh stats after successful update
      await fetchStats();
    } catch (err: any) {
      // Rollback on error
      setProducts(previousProducts);
      alert(err?.error?.message || 'Failed to update product status');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await apiDelete(`/api/v1/products/${productId}`);

      // Refresh stats and products
      await fetchStats();
      if (activeFilter) {
        await fetchProducts(activeFilter, currentPage);
      }

      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err?.error?.message || 'Failed to delete product');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Supplier Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {user?.tenant?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'supplier_admin' && (
                <Link href="/supplier/users">
                  <Button variant="outline" className="relative">
                    User Management
                    {pendingUserCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]">
                        {pendingUserCount > 99 ? '99+' : pendingUserCount}
                      </span>
                    )}
                  </Button>
                </Link>
              )}
              <Button onClick={logout} variant="outline">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div 
            className={`bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-lg ${
              activeFilter === 'all' ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleCardClick('all')}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-gray-900">
                    {isLoadingStats ? '...' : stats.totalProducts}
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Products
                    </dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-lg ${
              activeFilter === 'active' ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleCardClick('active')}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-gray-900">
                    {isLoadingStats ? '...' : stats.activeProducts}
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Products
                    </dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all hover:shadow-lg ${
              activeFilter === 'withPrivatePrices' ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleCardClick('withPrivatePrices')}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-gray-900">
                    {isLoadingStats ? '...' : stats.productsWithPrivatePrices}
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Private Prices
                    </dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product List Section */}
        {activeFilter && (
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {activeFilter === 'all' && 'All Products'}
                {activeFilter === 'active' && 'Active Products'}
                {activeFilter === 'withPrivatePrices' && 'Products with Private Prices'}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({searchQuery ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length : products.length})
                </span>
              </h2>
              <button
                onClick={() => {
                  setActiveFilter(null);
                  setProducts([]);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <Input
                  type="text"
                  placeholder="Search products by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full max-w-md"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {isLoadingProducts ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="mt-2 text-gray-500">Loading products...</p>
              </div>
            ) : (searchQuery ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())) : products).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? `No products found matching "${searchQuery}"` : 'No products found'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products
                      .filter(product => 
                        searchQuery === '' || 
                        product.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {product.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.defaultPrices && product.defaultPrices.length > 0 ? (
                            <span>
                              {product.defaultPrices[0].currency} {Number(product.defaultPrices[0].price).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">No price</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {product.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditProduct(product)}
                              className="h-8 px-3"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleInactive(product)}
                              className={`h-8 px-3 ${
                                !product.isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {product.isActive ? 'Inactive' : 'Activate'}
                            </Button>
                            {user?.role === 'supplier_admin' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteConfirm(product.id)}
                                className="h-8 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Showing {products.length > 0 ? ((currentPage - 1) * productsPerPage + 1) : 0} to {Math.min(currentPage * productsPerPage, totalProducts)} of {totalProducts} products
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = currentPage - 1;
                        setCurrentPage(newPage);
                        fetchProducts(activeFilter, newPage);
                      }}
                      disabled={currentPage === 1 || isLoadingProducts}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              setCurrentPage(pageNum);
                              fetchProducts(activeFilter, pageNum);
                            }}
                            disabled={isLoadingProducts}
                            className="min-w-[40px]"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = currentPage + 1;
                        setCurrentPage(newPage);
                        fetchProducts(activeFilter, newPage);
                      }}
                      disabled={currentPage === totalPages || isLoadingProducts}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="flex gap-4">
              <Button onClick={() => setShowAddProductModal(true)}>Add Product</Button>
              <Button variant="outline" disabled className="opacity-60 cursor-not-allowed">Import CSV</Button>
            </div>
          </div>
        </div>
      </main>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Add New Product</h2>
                <button
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                  Product created successfully!
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      name="sku"
                      value={formData.sku}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      placeholder="PROD-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit *</Label>
                    <Input
                      id="unit"
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      placeholder="piece, kg, m, etc."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    placeholder="Steel Beam 10x10"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Product description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      placeholder="Steel, Cement, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="defaultPrice">Default Price</Label>
                  <Input
                    id="defaultPrice"
                    name="defaultPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.defaultPrice}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    placeholder="150.00"
                  />
                </div>

                {/* Special Prices Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-base font-semibold">Special Prices (Optional)</Label>
                      <p className="text-sm text-gray-500 mt-1">Add company-specific prices for this product</p>
                    </div>
                    {!draftSpecialPrice && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddSpecialPrice}
                        disabled={isSubmitting || loadingCompanies}
                      >
                        + Add Company Price
                      </Button>
                    )}
                  </div>

                  {loadingCompanies && !draftSpecialPrice && includedSpecialPrices.length === 0 && (
                    <div className="text-sm text-gray-500 py-2">Loading companies...</div>
                  )}

                  {/* Draft Form */}
                  {draftSpecialPrice && (
                    <div className="border rounded-lg p-4 bg-blue-50 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          {editingSpecialPriceId ? 'Edit Company Price' : 'Add Company Price'}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancelDraft}
                          disabled={isSubmitting}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="draft-company">Company *</Label>
                          <select
                            id="draft-company"
                            value={draftSpecialPrice.companyId}
                            onChange={(e) => handleDraftChange('companyId', e.target.value)}
                            disabled={isSubmitting || loadingCompanies}
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Select a company</option>
                            {companies
                              .filter(company => 
                                company.id === draftSpecialPrice.companyId ||
                                !includedSpecialPrices.some(sp => sp.companyId === company.id)
                              )
                              .map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="draft-priceType">Pricing Type *</Label>
                          <select
                            id="draft-priceType"
                            value={draftSpecialPrice.priceType}
                            onChange={(e) => {
                              const newPriceType = e.target.value as 'price' | 'discount';
                              if (!draftSpecialPrice) return;
                              
                              // Update priceType and clear the opposite field in a single state update
                              if (newPriceType === 'price') {
                                setDraftSpecialPrice({
                                  ...draftSpecialPrice,
                                  priceType: 'price',
                                  discountPercentage: '',
                                });
                              } else {
                                setDraftSpecialPrice({
                                  ...draftSpecialPrice,
                                  priceType: 'discount',
                                  price: '',
                                });
                              }
                              setError(null);
                            }}
                            disabled={isSubmitting}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="price">Special Price</option>
                            <option value="discount">Discount %</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {draftSpecialPrice.priceType === 'price' ? (
                          <>
                            <div>
                              <Label htmlFor="draft-price">Special Price *</Label>
                              <Input
                                id="draft-price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={draftSpecialPrice.price}
                                onChange={(e) => handleDraftChange('price', e.target.value)}
                                disabled={isSubmitting}
                                placeholder="0.00"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="draft-currency">Currency</Label>
                              <select
                                id="draft-currency"
                                value={draftSpecialPrice.currency}
                                onChange={(e) => handleDraftChange('currency', e.target.value)}
                                disabled={isSubmitting}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="SGD">SGD</option>
                              </select>
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-2">
                            <Label htmlFor="draft-discount">Discount Percentage *</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="draft-discount"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={draftSpecialPrice.discountPercentage}
                                onChange={(e) => handleDraftChange('discountPercentage', e.target.value)}
                                disabled={isSubmitting}
                                placeholder="0.00"
                                required
                                className="flex-1 max-w-xs"
                              />
                              <span className="text-sm text-gray-500 whitespace-nowrap">%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Discount will be calculated from the default price ({formData.currency || 'USD'})</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <Label htmlFor="draft-notes">Notes (Optional)</Label>
                        <Input
                          id="draft-notes"
                          type="text"
                          value={draftSpecialPrice.notes}
                          onChange={(e) => handleDraftChange('notes', e.target.value)}
                          disabled={isSubmitting}
                          placeholder="Additional notes..."
                        />
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          onClick={handleIncludeSpecialPrice}
                          disabled={isSubmitting}
                          size="sm"
                        >
                          {editingSpecialPriceId ? 'Update' : 'Include'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Included Prices Table */}
                  {includedSpecialPrices.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Discount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {includedSpecialPrices.map((sp) => (
                              <tr key={sp.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {sp.companyName || 'Unknown'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {sp.priceType === 'price' ? 'Special Price' : 'Discount %'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {sp.priceType === 'price' 
                                    ? parseFloat(sp.price).toFixed(2)
                                    : `${parseFloat(sp.discountPercentage).toFixed(2)}%`
                                  }
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {sp.priceType === 'price' ? sp.currency : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {sp.notes || '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditSpecialPrice(sp.id)}
                                      disabled={isSubmitting}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveSpecialPrice(sp.id)}
                                      disabled={isSubmitting}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!draftSpecialPrice && includedSpecialPrices.length === 0 && !loadingCompanies && (
                    <div className="text-sm text-gray-500 py-4 text-center border border-dashed rounded-lg">
                      No special prices included. Click "Add Company Price" to add one.
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Product'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditProductModal && editingProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Edit Product</h2>
                <button
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                  Product updated successfully!
                </div>
              )}

              <form onSubmit={handleUpdateProduct} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sku">SKU *</Label>
                    <Input
                      id="edit-sku"
                      name="sku"
                      value={formData.sku}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      placeholder="PROD-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-unit">Unit *</Label>
                    <Input
                      id="edit-unit"
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      placeholder="piece, kg, m, etc."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-name">Product Name *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    placeholder="Steel Beam 10x10"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <textarea
                    id="edit-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Product description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-category">Category</Label>
                    <Input
                      id="edit-category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      placeholder="Steel, Cement, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-currency">Currency</Label>
                    <select
                      id="edit-currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-defaultPrice">Default Price</Label>
                  <Input
                    id="edit-defaultPrice"
                    name="defaultPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.defaultPrice}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    placeholder="150.00"
                  />
                </div>

                {/* Special Prices Section for Edit */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-base font-semibold">Special Prices (Optional)</Label>
                      <p className="text-sm text-gray-500 mt-1">Add or update company-specific prices for this product</p>
                    </div>
                    {!editDraftSpecialPrice && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddEditSpecialPrice}
                        disabled={isSubmitting || loadingCompanies}
                      >
                        + Add Company Price
                      </Button>
                    )}
                  </div>

                  {loadingCompanies && !editDraftSpecialPrice && editIncludedSpecialPrices.length === 0 && (
                    <div className="text-sm text-gray-500 py-2">Loading companies...</div>
                  )}

                  {/* Draft Form */}
                  {editDraftSpecialPrice && (
                    <div className="border rounded-lg p-4 bg-blue-50 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          {editingEditSpecialPriceId ? 'Edit Company Price' : 'Add Company Price'}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEditDraft}
                          disabled={isSubmitting}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-draft-company">Company *</Label>
                          <select
                            id="edit-draft-company"
                            value={editDraftSpecialPrice.companyId}
                            onChange={(e) => handleEditDraftChange('companyId', e.target.value)}
                            disabled={isSubmitting || loadingCompanies}
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Select a company</option>
                            {companies
                              .filter(company => 
                                company.id === editDraftSpecialPrice.companyId ||
                                !editIncludedSpecialPrices.some(sp => sp.companyId === company.id)
                              )
                              .map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="edit-draft-priceType">Pricing Type *</Label>
                          <select
                            id="edit-draft-priceType"
                            value={editDraftSpecialPrice.priceType}
                            onChange={(e) => {
                              const newPriceType = e.target.value as 'price' | 'discount';
                              if (!editDraftSpecialPrice) return;
                              
                              // Update priceType and clear the opposite field in a single state update
                              if (newPriceType === 'price') {
                                setEditDraftSpecialPrice({
                                  ...editDraftSpecialPrice,
                                  priceType: 'price',
                                  discountPercentage: '',
                                });
                              } else {
                                setEditDraftSpecialPrice({
                                  ...editDraftSpecialPrice,
                                  priceType: 'discount',
                                  price: '',
                                });
                              }
                              setError(null);
                            }}
                            disabled={isSubmitting}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="price">Special Price</option>
                            <option value="discount">Discount %</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {editDraftSpecialPrice.priceType === 'price' ? (
                          <>
                            <div>
                              <Label htmlFor="edit-draft-price">Special Price *</Label>
                              <Input
                                id="edit-draft-price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={editDraftSpecialPrice.price}
                                onChange={(e) => handleEditDraftChange('price', e.target.value)}
                                disabled={isSubmitting}
                                placeholder="0.00"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-draft-currency">Currency</Label>
                              <select
                                id="edit-draft-currency"
                                value={editDraftSpecialPrice.currency}
                                onChange={(e) => handleEditDraftChange('currency', e.target.value)}
                                disabled={isSubmitting}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="SGD">SGD</option>
                              </select>
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-2">
                            <Label htmlFor="edit-draft-discount">Discount Percentage *</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="edit-draft-discount"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={editDraftSpecialPrice.discountPercentage}
                                onChange={(e) => handleEditDraftChange('discountPercentage', e.target.value)}
                                disabled={isSubmitting}
                                placeholder="0.00"
                                required
                                className="flex-1 max-w-xs"
                              />
                              <span className="text-sm text-gray-500 whitespace-nowrap">%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Discount will be calculated from the default price ({formData.currency || 'USD'})</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <Label htmlFor="edit-draft-notes">Notes (Optional)</Label>
                        <Input
                          id="edit-draft-notes"
                          type="text"
                          value={editDraftSpecialPrice.notes}
                          onChange={(e) => handleEditDraftChange('notes', e.target.value)}
                          disabled={isSubmitting}
                          placeholder="Additional notes..."
                        />
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          onClick={handleIncludeEditSpecialPrice}
                          disabled={isSubmitting}
                          size="sm"
                        >
                          {editingEditSpecialPriceId ? 'Update' : 'Include'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Included Prices Table */}
                  {editIncludedSpecialPrices.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Discount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {editIncludedSpecialPrices.map((sp) => (
                              <tr key={sp.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {sp.companyName || 'Unknown'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {sp.priceType === 'price' ? 'Special Price' : 'Discount %'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {sp.priceType === 'price' 
                                    ? parseFloat(sp.price).toFixed(2)
                                    : `${parseFloat(sp.discountPercentage).toFixed(2)}%`
                                  }
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {sp.priceType === 'price' ? sp.currency : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {sp.notes || '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditEditSpecialPrice(sp.id)}
                                      disabled={isSubmitting}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveEditSpecialPrice(sp.id)}
                                      disabled={isSubmitting}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!editDraftSpecialPrice && editIncludedSpecialPrices.length === 0 && !loadingCompanies && (
                    <div className="text-sm text-gray-500 py-4 text-center border border-dashed rounded-lg">
                      No special prices included. Click "Add Company Price" to add one.
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update Product'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Product</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDeleteProduct(deleteConfirm)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


