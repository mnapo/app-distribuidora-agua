'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronRight,
  CreditCard,
  Factory,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Route,
  Settings,
  ShoppingCart,
  Truck,
  Users
} from 'lucide-react';
import {
  apiRequest,
  AuthResponse,
  Branch,
  ContainerBalance,
  ContainerMovement,
  ContainerType,
  Customer,
  DeliveryRoute,
  Dispenser,
  DispenserComodato,
  DispenserModel,
  Driver,
  Health,
  InventoryItem,
  Invoice,
  Order,
  Paginated,
  Payment,
  Permission,
  PriceList,
  Product,
  ProductCategory,
  ReportKpis,
  Role,
  Tenant,
  User,
  Vehicle,
  Warehouse
} from '../lib/api';

type DashboardData = {
  health: Health | null;
  users: User[];
  roles: Role[];
  permissions: Permission[];
  tenants: Tenant[];
  branches: Branch[];
  warehouses: Warehouse[];
  customers: Customer[];
  categories: ProductCategory[];
  products: Product[];
  priceLists: PriceList[];
  vehicles: Vehicle[];
  drivers: Driver[];
  deliveryRoutes: DeliveryRoute[];
  containerTypes: ContainerType[];
  containerMovements: ContainerMovement[];
  containerBalances: ContainerBalance[];
  dispenserModels: DispenserModel[];
  dispensers: Dispenser[];
  dispenserComodatos: DispenserComodato[];
  inventory: InventoryItem[];
  orders: Order[];
  invoices: Invoice[];
  payments: Payment[];
  kpis: ReportKpis | null;
};

type ModuleKey =
  | 'inicio'
  | 'clientes'
  | 'productos'
  | 'logistica'
  | 'ventas'
  | 'facturacion'
  | 'activos'
  | 'admin'
  | 'reportes';

type LogisticsTabKey = 'branches' | 'warehouses' | 'vehicles' | 'drivers' | 'routes';
type ProductTabKey = 'products' | 'categories' | 'priceLists' | 'prices';
type AssetsTabKey = 'containers' | 'movements' | 'balances' | 'equipment' | 'models' | 'loans';

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
};

type DraftOrderItem = {
  productId: string;
  quantity: string;
  unitPrice: string;
};

type TabItem<TKey extends string> = {
  key: TKey;
  label: string;
  icon: React.ReactNode;
  count?: number;
};

const initialData: DashboardData = {
  health: null,
  users: [],
  roles: [],
  permissions: [],
  tenants: [],
  branches: [],
  warehouses: [],
  customers: [],
  categories: [],
  products: [],
  priceLists: [],
  vehicles: [],
  drivers: [],
  deliveryRoutes: [],
  containerTypes: [],
  containerMovements: [],
  containerBalances: [],
  dispenserModels: [],
  dispensers: [],
  dispenserComodatos: [],
  inventory: [],
  orders: [],
  invoices: [],
  payments: [],
  kpis: null
};

const navItems: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  { key: 'inicio', label: 'Inicio', icon: <LayoutDashboard size={19} /> },
  { key: 'clientes', label: 'Clientes', icon: <Users size={19} /> },
  { key: 'productos', label: 'Productos', icon: <Package size={19} /> },
  { key: 'logistica', label: 'Logistica', icon: <Truck size={19} /> },
  { key: 'ventas', label: 'Ventas', icon: <ShoppingCart size={19} /> },
  { key: 'facturacion', label: 'Facturacion', icon: <CreditCard size={19} /> },
  { key: 'activos', label: 'Activos', icon: <Boxes size={19} /> },
  { key: 'admin', label: 'Administracion', icon: <Settings size={19} /> },
  { key: 'reportes', label: 'Reportes', icon: <BarChart3 size={19} /> }
];

const productUnitOptions = [
  ['unidad', 'Unidad'],
  ['bidon', 'Bidon'],
  ['pack', 'Pack'],
  ['caja', 'Caja'],
  ['botella', 'Botella'],
  ['litro', 'Litro'],
  ['servicio', 'Servicio']
];

export function Dashboard({
  session,
  onSessionUpdate,
  onLogout
}: {
  session: AuthResponse;
  onSessionUpdate: (session: AuthResponse) => void;
  onLogout: () => void;
}) {
  const [activeModule, setActiveModule] = useState<ModuleKey>('inicio');
  const [activeLogisticsTab, setActiveLogisticsTab] = useState<LogisticsTabKey>('branches');
  const [activeProductTab, setActiveProductTab] = useState<ProductTabKey>('products');
  const [activeAssetsTab, setActiveAssetsTab] = useState<AssetsTabKey>('containers');
  const [data, setData] = useState<DashboardData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [customerForm, setCustomerForm] = useState({
    type: 'PERSON',
    firstName: '',
    lastName: '',
    businessName: '',
    taxId: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    province: '',
    postalCode: '',
    reference: '',
    creditLimit: '',
    paymentTerms: '',
    priceListId: '',
    notes: ''
  });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [productForm, setProductForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    unit: 'unidad',
    liters: '',
    cost: '',
    price: '',
    tax: '',
    returnable: false,
    requiresContainer: false
  });
  const [branchForm, setBranchForm] = useState({ name: '', code: '', address: '', phone: '' });
  const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '', branchId: '', address: '' });
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    brand: '',
    model: '',
    year: '',
    capacity: '',
    status: 'ACTIVE'
  });
  const [driverForm, setDriverForm] = useState({
    userId: '',
    licenseNumber: '',
    licenseCategory: '',
    status: 'ACTIVE'
  });
  const [routeForm, setRouteForm] = useState({
    name: '',
    routeDate: '',
    warehouseId: '',
    driverId: '',
    vehicleId: '',
    notes: '',
    orderIds: [] as string[]
  });
  const [containerTypeForm, setContainerTypeForm] = useState({ name: '', code: '', capacity: '' });
  const [containerMovementForm, setContainerMovementForm] = useState({
    customerId: '',
    containerTypeId: '',
    type: 'DELIVERED',
    quantity: '1',
    reference: '',
    notes: ''
  });
  const [dispenserModelForm, setDispenserModelForm] = useState({ name: '', code: '', capacity: '' });
  const [dispenserForm, setDispenserForm] = useState({
    modelId: '',
    serialNumber: '',
    acquiredAt: '',
    notes: ''
  });
  const [dispenserComodatoForm, setDispenserComodatoForm] = useState({
    dispenserId: '',
    customerId: '',
    deliveredAt: '',
    depositAmount: '',
    notes: ''
  });
  const [orderForm, setOrderForm] = useState({
    customerId: '',
    productId: '',
    quantity: '1',
    unitPrice: '',
    requestedDeliveryAt: '',
    deliveryStreet: '',
    deliveryCity: '',
    deliveryProvince: '',
    deliveryReference: '',
    deliveryNotes: '',
    notes: ''
  });
  const [orderItems, setOrderItems] = useState<DraftOrderItem[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    customerId: '',
    amount: '',
    method: 'CASH',
    reference: '',
    notes: ''
  });
  const [userForm, setUserForm] = useState({
    email: '',
    password: 'Admin123!',
    firstName: '',
    lastName: '',
    roleId: ''
  });
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissionCodes: [] as string[]
  });
  const [tenantForm, setTenantForm] = useState({
    name: '',
    slug: '',
    status: 'ACTIVE',
    adminEmail: '',
    adminPassword: 'Admin123!',
    adminFirstName: 'Admin',
    adminLastName: ''
  });
  const [priceListForm, setPriceListForm] = useState({ name: '', isDefault: false });
  const [priceListItemForm, setPriceListItemForm] = useState({
    priceListId: '',
    productId: '',
    price: ''
  });
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingContainerTypeId, setEditingContainerTypeId] = useState<string | null>(null);
  const [editingDispenserModelId, setEditingDispenserModelId] = useState<string | null>(null);
  const [editingDispenserId, setEditingDispenserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editingTenantHasAdmin, setEditingTenantHasAdmin] = useState(false);
  const [editingPriceListId, setEditingPriceListId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const canManageTenant = !session.user.isPlatformAdmin;
  const firstRoleId = data.roles[0]?.id ?? '';
  const firstBranchId = data.branches[0]?.id ?? '';
  const firstCategoryId = data.categories[0]?.id ?? '';

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const activeSession = await ensureSession();
      const accessToken = activeSession.accessToken;
      const [
        health,
        users,
        roles,
        permissions,
        tenants,
        branches,
        warehouses,
        customers,
        categories,
        products,
        priceLists,
        vehicles,
        drivers,
        deliveryRoutes,
        containerTypes,
        containerMovements,
        containerBalances,
        dispenserModels,
        dispensers,
        dispenserComodatos,
        inventory,
        orders,
        invoices,
        payments,
        kpis
      ] = await Promise.all([
        request<Health>('/health').catch(() => null),
        canManageTenant ? request<User[]>('/users', { token: accessToken }) : Promise.resolve([]),
        canManageTenant ? request<Role[]>('/roles', { token: accessToken }) : Promise.resolve([]),
        canManageTenant ? request<Permission[]>('/permissions', { token: accessToken }) : Promise.resolve([]),
        session.user.isPlatformAdmin
          ? request<Tenant[]>('/tenants', { token: accessToken })
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Branch>>('/branches', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Warehouse>>('/warehouses', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Customer>>('/customers', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<ProductCategory>>('/product-categories', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Product>>('/products', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<PriceList>>('/price-lists', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Vehicle>>('/vehicles', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Driver>>('/drivers', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<DeliveryRoute>>('/delivery-routes', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<ContainerType>>('/containers/types', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<ContainerMovement>>('/containers/movements', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<ContainerBalance>>('/containers/balances', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<DispenserModel>>('/dispensers/models', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Dispenser>>('/dispensers', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<DispenserComodato>>('/dispensers/comodatos/list', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<InventoryItem>>('/inventory', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Order>>('/orders', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Invoice>>('/billing/invoices', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant
          ? request<Paginated<Payment>>('/billing/payments', { token: accessToken }).then((r) => r.data)
          : Promise.resolve([]),
        canManageTenant ? request<ReportKpis>('/reports/kpis', { token: accessToken }) : Promise.resolve(null)
      ]);

      setData({
        health,
        users,
        roles,
        permissions,
        tenants,
        branches,
        warehouses,
        customers,
        categories,
        products,
        priceLists,
        vehicles,
        drivers,
        deliveryRoutes,
        containerTypes,
        containerMovements,
        containerBalances,
        dispenserModels,
        dispensers,
        dispenserComodatos,
        inventory,
        orders,
        invoices,
        payments,
        kpis
      });

      setWarehouseForm((current) => ({ ...current, branchId: current.branchId || firstBranchId }));
      setProductForm((current) => ({ ...current, categoryId: current.categoryId || firstCategoryId }));
      setUserForm((current) => ({ ...current, roleId: current.roleId || firstRoleId }));
      setRouteForm((current) => ({
        ...current,
        warehouseId: current.warehouseId || warehouses[0]?.id || '',
        driverId: current.driverId || drivers[0]?.id || '',
        vehicleId: current.vehicleId || vehicles[0]?.id || ''
      }));
      setContainerMovementForm((current) => ({
        ...current,
        customerId: current.customerId || customers[0]?.id || '',
        containerTypeId: current.containerTypeId || containerTypes[0]?.id || ''
      }));
      setDispenserForm((current) => ({ ...current, modelId: current.modelId || dispenserModels[0]?.id || '' }));
      const activeComodatoDispenserIds = new Set(
        dispenserComodatos
          .filter((comodato) => comodato.status === 'ACTIVE')
          .map((comodato) => comodato.dispenser.id)
      );
      const nextAvailableDispenserId =
        dispensers.find(
          (dispenser) =>
            !activeComodatoDispenserIds.has(dispenser.id) &&
            dispenser.status !== 'MAINTENANCE' &&
            dispenser.status !== 'RETIRED'
        )?.id || '';

      setDispenserComodatoForm((current) => ({
        ...current,
        dispenserId: current.dispenserId || nextAvailableDispenserId,
        customerId: current.customerId || customers[0]?.id || ''
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!orderForm.customerId) return;

    const customer = data.customers.find((item) => item.id === orderForm.customerId);
    const address = customer?.addresses?.[0];
    if (!address) return;

    setOrderForm((current) => {
      if (
        current.customerId !== orderForm.customerId ||
        current.deliveryStreet ||
        current.deliveryCity ||
        current.deliveryProvince ||
        current.deliveryReference
      ) {
        return current;
      }

      return {
        ...current,
        deliveryStreet: address.street ?? '',
        deliveryCity: address.city ?? '',
        deliveryProvince: address.province ?? '',
        deliveryReference: address.reference ?? ''
      };
    });
  }, [data.customers, orderForm.customerId]);

  const metrics = useMemo(
    () => [
      { label: 'Clientes', value: String(data.customers.length), icon: <Users size={20} /> },
      { label: 'Productos', value: String(data.products.length), icon: <Package size={20} /> },
      { label: 'Pedidos', value: String(data.orders.length), icon: <ShoppingCart size={20} /> },
      { label: 'Facturas', value: String(data.invoices.length), icon: <FileText size={20} /> }
    ],
    [data.customers.length, data.invoices.length, data.orders.length, data.products.length]
  );

  async function refreshSession(): Promise<AuthResponse> {
    const nextSession = await apiRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken })
    });
    onSessionUpdate(nextSession);
    return nextSession;
  }

  async function ensureSession(): Promise<AuthResponse> {
    if (!isTokenExpired(session.accessToken)) {
      return session;
    }
    return refreshSession();
  }

  async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
    try {
      return await apiRequest<T>(path, options);
    } catch (requestError) {
      if (!isAuthError(requestError)) {
        throw requestError;
      }
      const nextSession = await refreshSession();
      return apiRequest<T>(path, { ...options, token: nextSession.accessToken });
    }
  }

  async function post<T>(path: string, body: object): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify(body)
    });
  }

  async function patch<T>(path: string, body: object): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      token: session.accessToken,
      body: JSON.stringify(body)
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>, action: () => Promise<void>) {
    event.preventDefault();
    setError(null);
    try {
      await action();
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar');
    }
  }

  async function createCustomer() {
    const isCompany = customerForm.type === 'COMPANY';
    const payload = {
      type: customerForm.type,
      businessName: isCompany ? customerForm.businessName : undefined,
      firstName: isCompany ? undefined : customerForm.firstName,
      lastName: isCompany ? undefined : customerForm.lastName,
      taxId: customerForm.taxId || undefined,
      email: customerForm.email || undefined,
      phone: customerForm.phone || undefined,
      creditLimit: customerForm.creditLimit ? Number(customerForm.creditLimit) : undefined,
    paymentTerms: customerForm.paymentTerms || undefined,
      priceListId: customerForm.priceListId || (editingCustomerId ? null : undefined),
      notes: customerForm.notes || undefined,
      addresses: customerForm.street
        ? [
            {
              street: customerForm.street,
              city: customerForm.city || undefined,
              province: customerForm.province || undefined,
              postalCode: customerForm.postalCode || undefined,
              reference: customerForm.reference || undefined,
              contactName: isCompany ? customerForm.businessName : `${customerForm.firstName} ${customerForm.lastName}`.trim(),
              contactPhone: customerForm.phone || undefined,
              isPrimary: true
            }
          ]
        : undefined
    };
    if (editingCustomerId) {
      await patch<Customer>(`/customers/${editingCustomerId}`, payload);
    } else {
      await post<Customer>('/customers', payload);
    }
    setCustomerForm({
      type: 'PERSON',
      firstName: '',
      lastName: '',
      businessName: '',
      taxId: '',
      email: '',
      phone: '',
      street: '',
      city: '',
      province: '',
      postalCode: '',
      reference: '',
      creditLimit: '',
      paymentTerms: '',
      priceListId: '',
      notes: ''
    });
    setEditingCustomerId(null);
  }

  async function createCategory() {
    if (editingCategoryId) {
      await patch<ProductCategory>(`/product-categories/${editingCategoryId}`, { name: categoryForm.name, active: true });
    } else {
      await post<ProductCategory>('/product-categories', { name: categoryForm.name, active: true });
    }
    setCategoryForm({ name: '' });
    setEditingCategoryId(null);
  }

  async function saveTenant() {
    if (editingTenantId) {
      await patch<Tenant>(`/tenants/${editingTenantId}`, {
        name: tenantForm.name,
        slug: tenantForm.slug,
        status: tenantForm.status,
        adminEmail: tenantForm.adminEmail || undefined,
        adminPassword: tenantForm.adminPassword || undefined,
        adminFirstName: tenantForm.adminFirstName || undefined,
        adminLastName: tenantForm.adminLastName || undefined
      });
    } else {
      await post<Tenant>('/tenants', {
        name: tenantForm.name,
        slug: tenantForm.slug,
        adminEmail: tenantForm.adminEmail,
        adminPassword: tenantForm.adminPassword,
        adminFirstName: tenantForm.adminFirstName,
        adminLastName: tenantForm.adminLastName
      });
    }
    resetTenantForm();
  }

  function resetTenantForm() {
    setTenantForm({ name: '', slug: '', status: 'ACTIVE', adminEmail: '', adminPassword: 'Admin123!', adminFirstName: 'Admin', adminLastName: '' });
    setEditingTenantId(null);
    setEditingTenantHasAdmin(false);
  }

  function editTenant(tenant: Tenant) {
    setEditingTenantId(tenant.id);
    setEditingTenantHasAdmin(Boolean(tenant.adminUser));
    setTenantForm({
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      adminEmail: tenant.adminUser?.email ?? '',
      adminPassword: '',
      adminFirstName: tenant.adminUser?.firstName ?? '',
      adminLastName: tenant.adminUser?.lastName ?? ''
    });
  }

  async function createProduct() {
    const payload = {
      sku: productForm.sku || `SKU-${Date.now()}`,
      barcode: productForm.barcode || undefined,
      name: productForm.name,
      description: productForm.description || undefined,
      categoryId: productForm.categoryId || undefined,
      unit: productForm.unit,
      liters: productForm.liters ? Number(productForm.liters) : undefined,
      cost: productForm.cost ? Number(productForm.cost) : undefined,
      price: productForm.price ? Number(productForm.price) : undefined,
      tax: productForm.tax ? Number(productForm.tax) : undefined,
      returnable: productForm.returnable,
      requiresContainer: productForm.requiresContainer,
      active: true
    };
    if (editingProductId) {
      await patch<Product>(`/products/${editingProductId}`, payload);
    } else {
      await post<Product>('/products', payload);
    }
    setProductForm({
      sku: '',
      barcode: '',
      name: '',
      description: '',
      categoryId: firstCategoryId,
      unit: 'unidad',
      liters: '',
      cost: '',
      price: '',
      tax: '',
      returnable: false,
      requiresContainer: false
    });
    setEditingProductId(null);
  }

  async function createPriceList() {
    const payload = {
      name: priceListForm.name,
      isDefault: priceListForm.isDefault || data.priceLists.length === 0,
      active: true
    };
    if (editingPriceListId) {
      await patch<PriceList>(`/price-lists/${editingPriceListId}`, payload);
    } else {
      await post<PriceList>('/price-lists', payload);
    }
    setPriceListForm({ name: '', isDefault: false });
    setEditingPriceListId(null);
  }

  async function savePriceListItem() {
    const priceList = data.priceLists.find((item) => item.id === priceListItemForm.priceListId);
    if (!priceList || !priceListItemForm.productId || !priceListItemForm.price) return;

    const items = [
      ...priceList.items
        .filter((item) => item.productId !== priceListItemForm.productId)
        .map((item) => ({ productId: item.productId, price: Number(item.price) })),
      { productId: priceListItemForm.productId, price: Number(priceListItemForm.price) }
    ];

    await patch<PriceList>(`/price-lists/${priceList.id}`, { items });
    setPriceListItemForm({ priceListId: priceList.id, productId: '', price: '' });
  }

  async function removePriceListItem(priceList: PriceList, productId: string) {
    const items = priceList.items
      .filter((item) => item.productId !== productId)
      .map((item) => ({ productId: item.productId, price: Number(item.price) }));

    await deactivate(`/price-lists/${priceList.id}`, { items });
  }

  async function createBranch() {
    if (editingBranchId) {
      await patch<Branch>(`/branches/${editingBranchId}`, { ...branchForm, active: true });
    } else {
      await post<Branch>('/branches', { ...branchForm, active: true });
    }
    setBranchForm({ name: '', code: '', address: '', phone: '' });
    setEditingBranchId(null);
  }

  async function createWarehouse() {
    const payload = {
      name: warehouseForm.name,
      code: warehouseForm.code || undefined,
      address: warehouseForm.address || undefined,
      branchId: warehouseForm.branchId || undefined,
      active: true
    };
    if (editingWarehouseId) {
      await patch<Warehouse>(`/warehouses/${editingWarehouseId}`, payload);
    } else {
      await post<Warehouse>('/warehouses', payload);
    }
    setWarehouseForm({ name: '', code: '', branchId: firstBranchId, address: '' });
    setEditingWarehouseId(null);
  }

  async function createVehicle() {
    const payload = {
      plate: vehicleForm.plate,
      brand: vehicleForm.brand || undefined,
      model: vehicleForm.model || undefined,
      year: vehicleForm.year ? Number(vehicleForm.year) : undefined,
      capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : undefined,
      status: vehicleForm.status
    };
    if (editingVehicleId) {
      await patch<Vehicle>(`/vehicles/${editingVehicleId}`, payload);
    } else {
      await post<Vehicle>('/vehicles', payload);
    }
    setVehicleForm({ plate: '', brand: '', model: '', year: '', capacity: '', status: 'ACTIVE' });
    setEditingVehicleId(null);
  }

  async function createDriver() {
    await post<Driver>('/drivers', {
      userId: driverForm.userId,
      licenseNumber: driverForm.licenseNumber || undefined,
      licenseCategory: driverForm.licenseCategory || undefined,
      status: driverForm.status
    });
    setDriverForm({ userId: '', licenseNumber: '', licenseCategory: '', status: 'ACTIVE' });
  }

  async function createDeliveryRoute() {
    if (!routeForm.orderIds.length) {
      throw new Error('Para crear una ruta, primero selecciona al menos un pedido confirmado');
    }
    const payload = {
      name: routeForm.name,
      routeDate: routeForm.routeDate,
      warehouseId: routeForm.warehouseId,
      driverId: routeForm.driverId,
      vehicleId: routeForm.vehicleId,
      notes: routeForm.notes || undefined,
      orders: routeForm.orderIds.map((orderId, index) => ({ orderId, sequence: index + 1 }))
    };
    if (editingRouteId) {
      await patch<DeliveryRoute>(`/delivery-routes/${editingRouteId}`, payload);
    } else {
      await post<DeliveryRoute>('/delivery-routes', payload);
    }
    resetRouteForm();
  }

  function resetRouteForm() {
    setRouteForm({
      name: '',
      routeDate: '',
      warehouseId: data.warehouses[0]?.id ?? '',
      driverId: data.drivers[0]?.id ?? '',
      vehicleId: data.vehicles[0]?.id ?? '',
      notes: '',
      orderIds: []
    });
    setEditingRouteId(null);
  }

  function editDeliveryRoute(route: DeliveryRoute) {
    if (route.status !== 'DRAFT') return;
    setEditingRouteId(route.id);
    setActiveLogisticsTab('routes');
    setRouteForm({
      name: route.name,
      routeDate: route.routeDate.slice(0, 10),
      warehouseId: route.warehouse.id,
      driverId: route.driver.id,
      vehicleId: route.vehicle.id,
      notes: '',
      orderIds: route.orders.map((routeOrder) => routeOrder.order.id)
    });
  }

  async function createContainerType() {
    const payload = {
      name: containerTypeForm.name,
      code: containerTypeForm.code || undefined,
      capacity: containerTypeForm.capacity ? Number(containerTypeForm.capacity) : undefined,
      active: true
    };
    if (editingContainerTypeId) {
      await patch<ContainerType>(`/containers/types/${editingContainerTypeId}`, payload);
    } else {
      await post<ContainerType>('/containers/types', payload);
    }
    setContainerTypeForm({ name: '', code: '', capacity: '' });
    setEditingContainerTypeId(null);
  }

  async function deactivateContainerType(typeId: string) {
    await patch<ContainerType>(`/containers/types/${typeId}`, { active: false });
    await loadData();
  }

  async function createContainerMovement() {
    const quantity = Number(containerMovementForm.quantity);
    if (containerMovementForm.type === 'RETURNED') {
      const available = currentContainerBalance(data.containerBalances, containerMovementForm.customerId, containerMovementForm.containerTypeId);
      if (available < quantity) {
        throw new Error(`El cliente tiene ${available} envases disponibles para devolver`);
      }
    }
    await post<ContainerMovement>('/containers/movements', {
      customerId: containerMovementForm.customerId,
      containerTypeId: containerMovementForm.containerTypeId,
      type: containerMovementForm.type,
      quantity,
      reference: containerMovementForm.reference || undefined,
      notes: containerMovementForm.notes || undefined
    });
    setContainerMovementForm((current) => ({ ...current, quantity: '1', reference: '', notes: '' }));
  }

  async function createDispenserModel() {
    const payload = {
      name: dispenserModelForm.name,
      code: dispenserModelForm.code || undefined,
      capacity: dispenserModelForm.capacity ? Number(dispenserModelForm.capacity) : undefined,
      active: true
    };
    if (editingDispenserModelId) {
      await patch<DispenserModel>(`/dispensers/models/${editingDispenserModelId}`, payload);
    } else {
      await post<DispenserModel>('/dispensers/models', payload);
    }
    setDispenserModelForm({ name: '', code: '', capacity: '' });
    setEditingDispenserModelId(null);
  }

  async function deactivateDispenserModel(modelId: string) {
    await patch<DispenserModel>(`/dispensers/models/${modelId}`, { active: false });
    await loadData();
  }

  async function createDispenser() {
    const payload = {
      modelId: dispenserForm.modelId,
      serialNumber: dispenserForm.serialNumber,
      acquiredAt: dispenserForm.acquiredAt || undefined,
      notes: dispenserForm.notes || undefined
    };
    if (editingDispenserId) {
      await patch<Dispenser>(`/dispensers/${editingDispenserId}`, payload);
    } else {
      await post<Dispenser>('/dispensers', payload);
    }
    setDispenserForm((current) => ({ modelId: current.modelId, serialNumber: '', acquiredAt: '', notes: '' }));
    setEditingDispenserId(null);
  }

  async function retireDispenser(dispenserId: string) {
    await patch<Dispenser>(`/dispensers/${dispenserId}`, { status: 'RETIRED' });
    await loadData();
  }

  async function reactivateDispenser(dispenserId: string) {
    await patch<Dispenser>(`/dispensers/${dispenserId}`, { status: 'AVAILABLE' });
    await loadData();
  }

  async function createDispenserComodato() {
    await post<DispenserComodato>('/dispensers/comodatos', {
      dispenserId: dispenserComodatoForm.dispenserId,
      customerId: dispenserComodatoForm.customerId,
      deliveredAt: dispenserComodatoForm.deliveredAt || undefined,
      depositAmount: dispenserComodatoForm.depositAmount ? Number(dispenserComodatoForm.depositAmount) : undefined,
      notes: dispenserComodatoForm.notes || undefined
    });
    setDispenserComodatoForm((current) => ({ ...current, dispenserId: '', deliveredAt: '', depositAmount: '', notes: '' }));
  }

  async function retireDispenserComodato(comodato: DispenserComodato) {
    await post<DispenserComodato>(`/dispensers/comodatos/${comodato.id}/retire`, { notes: 'Devolucion desde backoffice' });
    setDispenserComodatoForm((current) => ({ ...current, dispenserId: comodato.dispenser.id }));
    await loadData();
  }

  async function runRouteAction(routeId: string, action: 'prepare' | 'load-vehicle' | 'close-preliminary' | 'cancel') {
    setError(null);
    try {
      await post<DeliveryRoute>(`/delivery-routes/${routeId}/${action}`, { notes: 'Accion desde backoffice' });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar la ruta');
    }
  }

  async function saveOrder() {
    if (!orderItems.length) return;
    const payload = {
      customerId: orderForm.customerId,
      requestedDeliveryAt: orderForm.requestedDeliveryAt || undefined,
      deliveryStreet: orderForm.deliveryStreet || undefined,
      deliveryCity: orderForm.deliveryCity || undefined,
      deliveryProvince: orderForm.deliveryProvince || undefined,
      deliveryReference: orderForm.deliveryReference || undefined,
      deliveryNotes: orderForm.deliveryNotes || undefined,
      notes: orderForm.notes || undefined,
      items: orderItems.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined
      }))
    };
    if (editingOrderId) {
      await patch<Order>(`/orders/${editingOrderId}`, payload);
    } else {
      await post<Order>('/orders', payload);
    }
    setOrderForm({
      customerId: '',
      productId: '',
      quantity: '1',
      unitPrice: '',
      requestedDeliveryAt: '',
      deliveryStreet: '',
      deliveryCity: '',
      deliveryProvince: '',
      deliveryReference: '',
      deliveryNotes: '',
      notes: ''
    });
    setOrderItems([]);
    setEditingOrderId(null);
  }

  function addOrderItem() {
    if (!orderForm.productId || Number(orderForm.quantity) <= 0) return;
    setOrderItems((current) => {
      const existingIndex = current.findIndex((item) => item.productId === orderForm.productId);
      const nextItem = {
        productId: orderForm.productId,
        quantity: orderForm.quantity,
        unitPrice: orderForm.unitPrice || effectiveProductPrice(orderForm.customerId, orderForm.productId)
      };
      if (existingIndex === -1) return [...current, nextItem];
      return current.map((item, index) => (index === existingIndex ? nextItem : item));
    });
    setOrderForm((current) => ({
      ...current,
      productId: '',
      quantity: '1',
      unitPrice: ''
    }));
  }

  function updateOrderItem(index: number, changes: Partial<DraftOrderItem>) {
    setOrderItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  }

  function removeOrderItem(index: number) {
    setOrderItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function toggleRouteOrder(orderId: string, checked: boolean) {
    setRouteForm((current) => ({
      ...current,
      orderIds: checked
        ? [...current.orderIds, orderId]
        : current.orderIds.filter((currentOrderId) => currentOrderId !== orderId)
    }));
  }

  async function confirmOrder(orderId: string) {
    await post<Order>(`/orders/${orderId}/confirm`, {});
    await loadData();
  }

  async function cancelOrder(orderId: string) {
    await post<Order>(`/orders/${orderId}/cancel`, { reason: 'Cancelado desde backoffice' });
    await loadData();
  }

  function editOrder(order: Order) {
    setEditingOrderId(order.id);
    setOrderForm({
      customerId: order.customer.id,
      productId: '',
      quantity: '1',
      unitPrice: '',
      requestedDeliveryAt: '',
      deliveryStreet: order.deliveryStreet ?? '',
      deliveryCity: '',
      deliveryProvince: '',
      deliveryReference: '',
      deliveryNotes: '',
      notes: ''
    });
    setOrderItems(
      order.items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    );
  }

  async function createPayment() {
    await post<Payment>('/billing/payments', {
      customerId: paymentForm.customerId,
      amount: Number(paymentForm.amount),
      method: paymentForm.method,
      reference: paymentForm.reference || undefined,
      notes: paymentForm.notes || undefined
    });
    setPaymentForm({ customerId: '', amount: '', method: 'CASH', reference: '', notes: '' });
  }

  async function applyOpenInvoices(paymentId: string) {
    await post<Payment>(`/billing/payments/${paymentId}/apply-open-invoices`, {});
  }

  async function createUser() {
    const payload = {
      email: userForm.email,
      password: userForm.password,
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      roleIds: userForm.roleId ? [userForm.roleId] : []
    };
    if (editingUserId) {
      await patch<User>(`/users/${editingUserId}`, {
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        roleIds: userForm.roleId ? [userForm.roleId] : []
      });
    } else {
      await post<User>('/users', payload);
    }
    setUserForm({ email: '', password: 'Admin123!', firstName: '', lastName: '', roleId: firstRoleId });
    setEditingUserId(null);
  }

  async function createRole() {
    const payload = {
      name: roleForm.name,
      description: roleForm.description || undefined,
      permissionCodes: roleForm.permissionCodes
    };
    if (editingRoleId) {
      await patch<Role>(`/roles/${editingRoleId}`, payload);
    } else {
      await post<Role>('/roles', payload);
    }
    setRoleForm({ name: '', description: '', permissionCodes: [] });
    setEditingRoleId(null);
  }

  function editCustomer(customer: Customer) {
    const address = customer.addresses?.[0];
    setEditingCustomerId(customer.id);
    setCustomerForm({
      type: customer.type,
      firstName: customer.firstName ?? '',
      lastName: customer.lastName ?? '',
      businessName: customer.businessName ?? '',
      taxId: customer.taxId ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      street: address?.street ?? '',
      city: address?.city ?? '',
      province: address?.province ?? '',
      postalCode: address?.postalCode ?? '',
      reference: address?.reference ?? '',
      creditLimit: customer.creditLimit ?? '',
      paymentTerms: customer.paymentTerms ?? '',
      priceListId: customer.priceListId ?? '',
      notes: customer.notes ?? ''
    });
  }

  function effectiveProductPrice(customerId: string, productId: string): string {
    const customer = data.customers.find((item) => item.id === customerId);
    const product = data.products.find((item) => item.id === productId);
    if (!product) return '';

    const assignedPrice = customer?.priceListId
      ? data.priceLists
          .find((priceList) => priceList.id === customer.priceListId)
          ?.items.find((item) => item.productId === productId)?.price
      : undefined;
    const defaultPrice = data.priceLists
      .find((priceList) => priceList.isDefault)
      ?.items.find((item) => item.productId === productId)?.price;

    return assignedPrice ?? defaultPrice ?? product.price;
  }

  function updateOrderCustomer(customerId: string) {
    const customer = data.customers.find((item) => item.id === customerId);
    const address = customer?.addresses?.[0];

    setOrderForm((current) => ({
      ...current,
      customerId,
      deliveryStreet: address?.street ?? '',
      deliveryCity: address?.city ?? '',
      deliveryProvince: address?.province ?? '',
      deliveryReference: address?.reference ?? '',
      unitPrice: current.productId ? effectiveProductPrice(customerId, current.productId) : current.unitPrice
    }));
  }

  function updateOrderProduct(productId: string) {
    setOrderForm((current) => ({
      ...current,
      productId,
      unitPrice: current.customerId ? effectiveProductPrice(current.customerId, productId) : effectiveProductPrice('', productId)
    }));
  }

  function orderDraftTotal(): number {
    return orderItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  }

  function editProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      sku: product.sku,
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      categoryId: product.category?.id ?? '',
      unit: product.unit,
      liters: product.liters ?? '',
      cost: product.cost ?? '',
      price: product.price,
      tax: product.tax ?? '',
      returnable: Boolean(product.returnable),
      requiresContainer: Boolean(product.requiresContainer)
    });
  }

  async function deactivate(path: string, body: object) {
    setError(null);
    try {
      await patch(path, body);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo desactivar');
    }
  }

  function renderActiveModule() {
    if (session.user.isPlatformAdmin) {
      return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_1fr]">
          <Panel title={editingTenantId ? 'Editar distribuidora' : 'Nueva distribuidora'} icon={<Building2 size={18} />}>
            <form onSubmit={(event) => submitForm(event, saveTenant)} className="grid gap-4">
              <Field
                label="Nombre"
                value={tenantForm.name}
                onChange={(value) => {
                  const nextSlug = slugFromName(value);
                  setTenantForm({
                    ...tenantForm,
                    name: value,
                    slug: editingTenantId || tenantForm.slug ? tenantForm.slug : nextSlug,
                    adminEmail: !editingTenantId && !tenantForm.adminEmail ? adminEmailFromSlug(nextSlug) : tenantForm.adminEmail,
                    adminLastName: !editingTenantId && !tenantForm.adminLastName ? value : tenantForm.adminLastName
                  });
                }}
                required
              />
              <Field
                label="Slug"
                value={tenantForm.slug}
                onChange={(value) => {
                  const nextSlug = slugFromName(value);
                  setTenantForm({
                    ...tenantForm,
                    slug: nextSlug,
                    adminEmail: !editingTenantId && !tenantForm.adminEmail ? adminEmailFromSlug(nextSlug) : tenantForm.adminEmail
                  });
                }}
                placeholder="distribuidora-oeste"
                required={!editingTenantId}
              />
              <div className="grid gap-3 border-t border-border pt-4">
                <p className="text-sm font-semibold text-slate-700">{editingTenantId ? 'Administrador' : 'Administrador inicial'}</p>
                <Field
                  label="Email administrador"
                  type="email"
                  value={tenantForm.adminEmail}
                  onChange={(value) => setTenantForm({ ...tenantForm, adminEmail: value })}
                  placeholder={adminEmailFromSlug(tenantForm.slug)}
                  required
                />
                <Field
                  label={editingTenantId ? 'Nuevo password' : 'Password inicial'}
                  type="password"
                  value={tenantForm.adminPassword}
                  onChange={(value) => setTenantForm({ ...tenantForm, adminPassword: value })}
                  placeholder={editingTenantId ? 'Completar solo para cambiar' : undefined}
                  required={!editingTenantId || !editingTenantHasAdmin}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Nombre"
                    value={tenantForm.adminFirstName}
                    onChange={(value) => setTenantForm({ ...tenantForm, adminFirstName: value })}
                    required
                  />
                  <Field
                    label="Apellido"
                    value={tenantForm.adminLastName}
                    onChange={(value) => setTenantForm({ ...tenantForm, adminLastName: value })}
                    required
                  />
                </div>
              </div>
              {editingTenantId ? (
                <Select
                  label="Estado"
                  value={tenantForm.status}
                  onChange={(value) => setTenantForm({ ...tenantForm, status: value })}
                  options={[
                    ['ACTIVE', 'Activa'],
                    ['SUSPENDED', 'Suspendida'],
                    ['INACTIVE', 'Inactiva']
                  ]}
                  required
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <PrimaryButton>{editingTenantId ? 'Actualizar distribuidora' : 'Guardar distribuidora'}</PrimaryButton>
                {editingTenantId ? (
                  <button
                    type="button"
                    onClick={resetTenantForm}
                    className="h-10 border border-border bg-white px-4 text-sm font-semibold hover:border-primary"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </Panel>
          <Panel title="Distribuidoras" icon={<FileText size={18} />}>
            <Table
              headers={['Nombre', 'Slug', 'Admin', 'Estado', 'Acciones']}
              rows={data.tenants.map((tenant) => [
                tenant.name,
                tenant.slug,
                tenant.adminUser?.email ?? 'Sin admin',
                tenantStatusLabel(tenant.status),
                <ActionButtons
                  key={tenant.id}
                  onEdit={() => editTenant(tenant)}
                  onDeactivate={() => void deactivate(`/tenants/${tenant.id}`, { status: tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
                  disabled={tenant.status === 'INACTIVE'}
                  deactivateLabel={tenant.status === 'ACTIVE' ? 'Suspender' : 'Activar'}
                />
              ])}
            />
          </Panel>
        </div>
      );
    }

    const editingRoute = editingRouteId ? data.deliveryRoutes.find((route) => route.id === editingRouteId) : null;
    const routeCandidateOrders = [
      ...data.orders.filter((order) => order.status === 'CONFIRMED' || order.status === 'FAILED_DELIVERY'),
      ...(editingRoute?.orders.map((routeOrder) => routeOrder.order) ?? [])
    ].filter((order, index, orders) => orders.findIndex((current) => current.id === order.id) === index);
    const routeCreationMessage = routeCandidateOrders.length
      ? 'Selecciona al menos un pedido confirmado para crear la ruta.'
      : 'No hay pedidos confirmados disponibles para asignar a una ruta.';
    const canCreateRoute = routeForm.orderIds.length > 0;
    const selectedOrderCustomer = data.customers.find((customer) => customer.id === orderForm.customerId);
    const selectedOrderCustomerAddress = selectedOrderCustomer?.addresses?.[0];

    switch (activeModule) {
      case 'clientes':
        return (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
            <Panel title={editingCustomerId ? 'Editar cliente' : 'Nuevo cliente'} icon={<Users size={18} />}>
              <form onSubmit={(event) => submitForm(event, createCustomer)} className="grid gap-5">
                <FormSection title="Datos principales">
                  <Select
                    label="Tipo"
                    value={customerForm.type}
                    onChange={(value) => setCustomerForm({ ...customerForm, type: value })}
                    options={[
                      ['PERSON', 'Persona'],
                      ['COMPANY', 'Empresa']
                    ]}
                  />
                  {customerForm.type === 'COMPANY' ? (
                    <Field
                      label="Razon social"
                      value={customerForm.businessName}
                      onChange={(value) => setCustomerForm({ ...customerForm, businessName: value })}
                      required
                    />
                  ) : (
                    <>
                      <Field
                        label="Nombre"
                        value={customerForm.firstName}
                        onChange={(value) => setCustomerForm({ ...customerForm, firstName: value })}
                        required
                      />
                      <Field
                        label="Apellido"
                        value={customerForm.lastName}
                        onChange={(value) => setCustomerForm({ ...customerForm, lastName: value })}
                        required
                      />
                    </>
                  )}
                  <Field label="CUIT/DNI" value={customerForm.taxId} onChange={(value) => setCustomerForm({ ...customerForm, taxId: value })} />
                </FormSection>
                <FormSection title="Contacto">
                  <Field label="Email" type="email" value={customerForm.email} onChange={(value) => setCustomerForm({ ...customerForm, email: value })} />
                  <Field label="Telefono" value={customerForm.phone} onChange={(value) => setCustomerForm({ ...customerForm, phone: value })} />
                </FormSection>
                <FormSection title="Direccion de entrega">
                  <Field label="Calle y numero" value={customerForm.street} onChange={(value) => setCustomerForm({ ...customerForm, street: value })} />
                  <Field label="Localidad" value={customerForm.city} onChange={(value) => setCustomerForm({ ...customerForm, city: value })} />
                  <Field label="Provincia" value={customerForm.province} onChange={(value) => setCustomerForm({ ...customerForm, province: value })} />
                  <Field label="Codigo postal" value={customerForm.postalCode} onChange={(value) => setCustomerForm({ ...customerForm, postalCode: value })} />
                  <Field label="Referencia" value={customerForm.reference} onChange={(value) => setCustomerForm({ ...customerForm, reference: value })} />
                </FormSection>
                <FormSection title="Condiciones comerciales">
                  <Field label="Limite credito" type="number" value={customerForm.creditLimit} onChange={(value) => setCustomerForm({ ...customerForm, creditLimit: value })} />
                  <Field label="Condicion pago" value={customerForm.paymentTerms} onChange={(value) => setCustomerForm({ ...customerForm, paymentTerms: value })} />
                  <Select
                    label="Lista de precios"
                    value={customerForm.priceListId}
                    onChange={(value) => setCustomerForm({ ...customerForm, priceListId: value })}
                    options={data.priceLists.filter((priceList) => priceList.active).map((priceList) => [priceList.id, priceList.name])}
                  />
                </FormSection>
                <TextArea label="Notas" value={customerForm.notes} onChange={(value) => setCustomerForm({ ...customerForm, notes: value })} />
                <div className="flex justify-end">
                  <PrimaryButton>{editingCustomerId ? 'Actualizar cliente' : 'Guardar cliente'}</PrimaryButton>
                </div>
              </form>
            </Panel>
            <Panel title="Clientes cargados" icon={<FileText size={18} />}>
              <Table
                headers={['Cliente', 'Telefono', 'Email', 'Direccion', 'Lista', 'Estado', 'Acciones']}
                rows={data.customers.map((customer) => [
                  customerName(customer),
                  customer.phone ?? '',
                  customer.email ?? '',
                  customerAddressLabel(customer),
                  customer.priceList?.name ?? data.priceLists.find((priceList) => priceList.id === customer.priceListId)?.name ?? '',
                  customer.status,
                  <ActionButtons
                    key={customer.id}
                    onEdit={() => editCustomer(customer)}
                    onDeactivate={() => void deactivate(`/customers/${customer.id}`, { status: 'INACTIVE' })}
                    disabled={customer.status !== 'ACTIVE'}
                  />
                ])}
              />
            </Panel>
          </div>
        );
      case 'productos': {
        const productTabs: TabItem<ProductTabKey>[] = [
          { key: 'products', label: 'Productos', icon: <Package size={16} />, count: data.products.length },
          { key: 'categories', label: 'Categorias', icon: <Boxes size={16} />, count: data.categories.length },
          { key: 'priceLists', label: 'Listas', icon: <FileText size={16} />, count: data.priceLists.length },
          {
            key: 'prices',
            label: 'Precios',
            icon: <CreditCard size={16} />,
            count: data.priceLists.reduce((total, priceList) => total + priceList.items.length, 0)
          }
        ];

        return (
          <div className="grid gap-4">
            <Panel title="Catalogo de productos" icon={<Package size={18} />}>
              <AdminTabs tabs={productTabs} activeKey={activeProductTab} onChange={setActiveProductTab} />
              <div className="mt-5">
                {activeProductTab === 'products' ? (
                  <EntitySection title={editingProductId ? 'Editar producto' : 'Nuevo producto'} tableTitle="Productos cargados">
                    <form onSubmit={(event) => submitForm(event, createProduct)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="SKU" value={productForm.sku} onChange={(value) => setProductForm({ ...productForm, sku: value })} />
                        <Field label="Codigo barras" value={productForm.barcode} onChange={(value) => setProductForm({ ...productForm, barcode: value })} />
                        <Field label="Nombre" value={productForm.name} onChange={(value) => setProductForm({ ...productForm, name: value })} required />
                        <Select label="Categoria" value={productForm.categoryId} onChange={(value) => setProductForm({ ...productForm, categoryId: value })} options={data.categories.map((category) => [category.id, category.name])} />
                        <Select label="Unidad" value={productForm.unit} onChange={(value) => setProductForm({ ...productForm, unit: value })} options={productUnitOptions} required />
                        <Field label="Litros" type="number" value={productForm.liters} onChange={(value) => setProductForm({ ...productForm, liters: value })} />
                        <Field label="Costo" type="number" value={productForm.cost} onChange={(value) => setProductForm({ ...productForm, cost: value })} />
                        <Field label="Precio" type="number" value={productForm.price} onChange={(value) => setProductForm({ ...productForm, price: value })} />
                        <Field label="IVA %" type="number" value={productForm.tax} onChange={(value) => setProductForm({ ...productForm, tax: value })} />
                      </div>
                      <TextArea label="Descripcion" value={productForm.description} onChange={(value) => setProductForm({ ...productForm, description: value })} />
                      <div className="flex flex-wrap gap-3">
                        <Check label="Retornable" checked={productForm.returnable} onChange={(value) => setProductForm({ ...productForm, returnable: value })} />
                        <Check label="Requiere envase" checked={productForm.requiresContainer} onChange={(value) => setProductForm({ ...productForm, requiresContainer: value })} />
                      </div>
                      <div className="flex justify-end">
                        <PrimaryButton>{editingProductId ? 'Actualizar producto' : 'Guardar producto'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['SKU', 'Producto', 'Categoria', 'Unidad', 'Precio base', 'Precios listas', 'Acciones']}
                      rows={data.products.map((product) => [
                        product.sku,
                        product.name,
                        product.category?.name ?? '',
                        product.unit,
                        product.price,
                        data.priceLists
                          .flatMap((priceList) =>
                            priceList.items
                              .filter((item) => item.productId === product.id)
                              .map((item) => `${priceList.name}: ${item.price}`)
                          )
                          .join(' | '),
                        <ActionButtons
                          key={product.id}
                          onEdit={() => editProduct(product)}
                          onDeactivate={() => void deactivate(`/products/${product.id}`, { active: false })}
                          disabled={!product.active}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeProductTab === 'categories' ? (
                  <EntitySection title={editingCategoryId ? 'Editar categoria' : 'Nueva categoria'} tableTitle="Categorias cargadas">
                    <form onSubmit={(event) => submitForm(event, createCategory)} className="grid gap-4">
                      <Field label="Nombre categoria" value={categoryForm.name} onChange={(value) => setCategoryForm({ name: value })} required />
                      <div className="flex justify-end">
                        <PrimaryButton>{editingCategoryId ? 'Actualizar categoria' : 'Guardar categoria'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Categoria', 'Estado', 'Acciones']}
                      rows={data.categories.map((category) => [
                        category.name,
                        category.active ? 'Activa' : 'Inactiva',
                        <ActionButtons
                          key={category.id}
                          onEdit={() => {
                            setEditingCategoryId(category.id);
                            setCategoryForm({ name: category.name });
                          }}
                          onDeactivate={() => void deactivate(`/product-categories/${category.id}`, { active: false })}
                          disabled={!category.active}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeProductTab === 'priceLists' ? (
                  <EntitySection title={editingPriceListId ? 'Editar lista de precios' : 'Nueva lista de precios'} tableTitle="Listas de precios cargadas">
                    <form onSubmit={(event) => submitForm(event, createPriceList)} className="grid gap-4">
                      <Field label="Nombre lista" value={priceListForm.name} onChange={(value) => setPriceListForm({ ...priceListForm, name: value })} required />
                      <Check label="Lista predeterminada" checked={priceListForm.isDefault} onChange={(value) => setPriceListForm({ ...priceListForm, isDefault: value })} />
                      <div className="flex justify-end">
                        <PrimaryButton>{editingPriceListId ? 'Actualizar lista' : 'Guardar lista'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Lista', 'Default', 'Estado', 'Acciones']}
                      rows={data.priceLists.map((priceList) => [
                        priceList.name,
                        priceList.isDefault ? 'Si' : 'No',
                        priceList.active ? 'Activa' : 'Inactiva',
                        <ActionButtons
                          key={priceList.id}
                          onEdit={() => {
                            setEditingPriceListId(priceList.id);
                            setPriceListForm({ name: priceList.name, isDefault: priceList.isDefault });
                          }}
                          onDeactivate={() => void deactivate(`/price-lists/${priceList.id}`, { active: false })}
                          disabled={!priceList.active}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeProductTab === 'prices' ? (
                  <EntitySection title="Nuevo precio por lista" tableTitle="Precios por lista cargados">
                    <form onSubmit={(event) => submitForm(event, savePriceListItem)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select
                          label="Lista"
                          value={priceListItemForm.priceListId}
                          onChange={(value) => setPriceListItemForm({ ...priceListItemForm, priceListId: value })}
                          options={data.priceLists.filter((priceList) => priceList.active).map((priceList) => [priceList.id, priceList.name])}
                          required
                        />
                        <Select
                          label="Producto"
                          value={priceListItemForm.productId}
                          onChange={(value) => setPriceListItemForm({ ...priceListItemForm, productId: value })}
                          options={data.products.filter((product) => product.active).map((product) => [product.id, `${product.sku} - ${product.name}`])}
                          required
                        />
                        <Field
                          label="Precio en esta lista"
                          type="number"
                          value={priceListItemForm.price}
                          onChange={(value) => setPriceListItemForm({ ...priceListItemForm, price: value })}
                          required
                        />
                      </div>
                      <div className="flex justify-end">
                        <PrimaryButton>Guardar precio</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Lista', 'Producto', 'Precio', 'Acciones']}
                      rows={data.priceLists.flatMap((priceList) =>
                        priceList.items.map((item) => [
                          priceList.name,
                          item.product?.name ?? data.products.find((product) => product.id === item.productId)?.name ?? item.productId,
                          item.price,
                          <button
                            key={`${priceList.id}-${item.productId}`}
                            type="button"
                            onClick={() => void removePriceListItem(priceList, item.productId)}
                            className="border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:border-red-500"
                          >
                            Quitar
                          </button>
                        ])
                      )}
                    />
                  </EntitySection>
                ) : null}
              </div>
            </Panel>
          </div>
        );
      }
      case 'logistica': {
        const logisticsTabs: TabItem<LogisticsTabKey>[] = [
          { key: 'branches', label: 'Sucursales', icon: <Building2 size={16} />, count: data.branches.length },
          { key: 'warehouses', label: 'Depositos', icon: <Factory size={16} />, count: data.warehouses.length },
          { key: 'vehicles', label: 'Vehiculos', icon: <Truck size={16} />, count: data.vehicles.length },
          { key: 'drivers', label: 'Choferes', icon: <Route size={16} />, count: data.drivers.length },
          { key: 'routes', label: 'Rutas', icon: <Route size={16} />, count: data.deliveryRoutes.length }
        ];

        return (
          <div className="grid gap-4">
            <Panel title="Configuracion logistica" icon={<Truck size={18} />}>
              <AdminTabs tabs={logisticsTabs} activeKey={activeLogisticsTab} onChange={setActiveLogisticsTab} />
              <div className="mt-5">
                {activeLogisticsTab === 'branches' ? (
                  <EntitySection title={editingBranchId ? 'Editar sucursal' : 'Nueva sucursal'} tableTitle="Sucursales registradas">
                    <form onSubmit={(event) => submitForm(event, createBranch)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nombre" value={branchForm.name} onChange={(value) => setBranchForm({ ...branchForm, name: value })} required />
                        <Field label="Codigo" value={branchForm.code} onChange={(value) => setBranchForm({ ...branchForm, code: value })} />
                        <Field label="Telefono" value={branchForm.phone} onChange={(value) => setBranchForm({ ...branchForm, phone: value })} />
                        <Field label="Direccion" value={branchForm.address} onChange={(value) => setBranchForm({ ...branchForm, address: value })} />
                      </div>
                      <div className="flex justify-end">
                        <PrimaryButton>{editingBranchId ? 'Actualizar sucursal' : 'Guardar sucursal'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Sucursal', 'Codigo', 'Telefono', 'Acciones']}
                      rows={data.branches.map((branch) => [
                        branch.name,
                        branch.code ?? '',
                        branch.phone ?? '',
                        <ActionButtons
                          key={branch.id}
                          onEdit={() => {
                            setEditingBranchId(branch.id);
                            setBranchForm({
                              name: branch.name,
                              code: branch.code ?? '',
                              address: branch.address ?? '',
                              phone: branch.phone ?? ''
                            });
                          }}
                          onDeactivate={() => void deactivate(`/branches/${branch.id}`, { active: false })}
                          disabled={!branch.active}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeLogisticsTab === 'warehouses' ? (
                  <EntitySection title={editingWarehouseId ? 'Editar deposito' : 'Nuevo deposito'} tableTitle="Depositos registrados">
                    <form onSubmit={(event) => submitForm(event, createWarehouse)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nombre" value={warehouseForm.name} onChange={(value) => setWarehouseForm({ ...warehouseForm, name: value })} required />
                        <Field label="Codigo" value={warehouseForm.code} onChange={(value) => setWarehouseForm({ ...warehouseForm, code: value })} />
                        <Select label="Sucursal" value={warehouseForm.branchId} onChange={(value) => setWarehouseForm({ ...warehouseForm, branchId: value })} options={data.branches.map((branch) => [branch.id, branch.name])} />
                        <Field label="Direccion" value={warehouseForm.address} onChange={(value) => setWarehouseForm({ ...warehouseForm, address: value })} />
                      </div>
                      <div className="flex justify-end">
                        <PrimaryButton>{editingWarehouseId ? 'Actualizar deposito' : 'Guardar deposito'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Deposito', 'Sucursal', 'Codigo', 'Acciones']}
                      rows={data.warehouses.map((warehouse) => [
                        warehouse.name,
                        warehouse.branch?.name ?? '',
                        warehouse.code ?? '',
                        <ActionButtons
                          key={warehouse.id}
                          onEdit={() => {
                            setEditingWarehouseId(warehouse.id);
                            setWarehouseForm({
                              name: warehouse.name,
                              code: warehouse.code ?? '',
                              branchId: warehouse.branch?.id ?? '',
                              address: warehouse.address ?? ''
                            });
                          }}
                          onDeactivate={() => void deactivate(`/warehouses/${warehouse.id}`, { active: false })}
                          disabled={!warehouse.active}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeLogisticsTab === 'vehicles' ? (
                  <EntitySection title={editingVehicleId ? 'Editar vehiculo' : 'Nuevo vehiculo'} tableTitle="Vehiculos registrados">
                    <form onSubmit={(event) => submitForm(event, createVehicle)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Patente" value={vehicleForm.plate} onChange={(value) => setVehicleForm({ ...vehicleForm, plate: value })} required />
                        <Field label="Marca" value={vehicleForm.brand} onChange={(value) => setVehicleForm({ ...vehicleForm, brand: value })} />
                        <Field label="Modelo" value={vehicleForm.model} onChange={(value) => setVehicleForm({ ...vehicleForm, model: value })} />
                        <Field label="Anio" type="number" value={vehicleForm.year} onChange={(value) => setVehicleForm({ ...vehicleForm, year: value })} />
                        <Field label="Capacidad" type="number" value={vehicleForm.capacity} onChange={(value) => setVehicleForm({ ...vehicleForm, capacity: value })} />
                        <Select label="Estado" value={vehicleForm.status} onChange={(value) => setVehicleForm({ ...vehicleForm, status: value })} options={[['ACTIVE', 'Activo'], ['MAINTENANCE', 'Mantenimiento'], ['INACTIVE', 'Inactivo']]} />
                      </div>
                      <div className="flex justify-end">
                        <PrimaryButton>{editingVehicleId ? 'Actualizar vehiculo' : 'Guardar vehiculo'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Patente', 'Marca', 'Modelo', 'Estado', 'Acciones']}
                      rows={data.vehicles.map((vehicle) => [
                        vehicle.plate,
                        vehicle.brand ?? '',
                        vehicle.model ?? '',
                        vehicle.status,
                        <ActionButtons
                          key={vehicle.id}
                          onEdit={() => {
                            setEditingVehicleId(vehicle.id);
                            setVehicleForm({
                              plate: vehicle.plate,
                              brand: vehicle.brand ?? '',
                              model: vehicle.model ?? '',
                              year: vehicle.year ? String(vehicle.year) : '',
                              capacity: vehicle.capacity ?? '',
                              status: vehicle.status
                            });
                          }}
                          onDeactivate={() => void deactivate(`/vehicles/${vehicle.id}`, { status: 'INACTIVE' })}
                          disabled={vehicle.status !== 'ACTIVE'}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeLogisticsTab === 'drivers' ? (
                  <EntitySection title="Nuevo chofer" tableTitle="Choferes registrados">
                    <form onSubmit={(event) => submitForm(event, createDriver)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label="Usuario" value={driverForm.userId} onChange={(value) => setDriverForm({ ...driverForm, userId: value })} options={data.users.map((user) => [user.id, `${user.firstName} ${user.lastName}`])} required />
                        <Field label="Licencia" value={driverForm.licenseNumber} onChange={(value) => setDriverForm({ ...driverForm, licenseNumber: value })} />
                        <Field label="Categoria" value={driverForm.licenseCategory} onChange={(value) => setDriverForm({ ...driverForm, licenseCategory: value })} />
                        <Select label="Estado" value={driverForm.status} onChange={(value) => setDriverForm({ ...driverForm, status: value })} options={[['ACTIVE', 'Activo'], ['INACTIVE', 'Inactivo']]} />
                      </div>
                      <div className="flex justify-end">
                        <PrimaryButton>Guardar chofer</PrimaryButton>
                      </div>
                    </form>
                    <Table headers={['Chofer', 'Licencia', 'Estado']} rows={data.drivers.map((driver) => [`${driver.user.firstName} ${driver.user.lastName}`, driver.licenseNumber ?? '', driver.status])} />
                  </EntitySection>
                ) : null}
                {activeLogisticsTab === 'routes' ? (
                  <EntitySection title={editingRouteId ? 'Editar ruta de reparto' : 'Nueva ruta de reparto'} tableTitle="Rutas registradas">
                    <form onSubmit={(event) => submitForm(event, createDeliveryRoute)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nombre" value={routeForm.name} onChange={(value) => setRouteForm({ ...routeForm, name: value })} required />
                        <Field label="Fecha" type="date" value={routeForm.routeDate} onChange={(value) => setRouteForm({ ...routeForm, routeDate: value })} required />
                        <Select label="Deposito" value={routeForm.warehouseId} onChange={(value) => setRouteForm({ ...routeForm, warehouseId: value })} options={data.warehouses.map((warehouse) => [warehouse.id, warehouse.name])} required />
                        <Select label="Chofer" value={routeForm.driverId} onChange={(value) => setRouteForm({ ...routeForm, driverId: value })} options={data.drivers.map((driver) => [driver.id, `${driver.user.firstName} ${driver.user.lastName}`])} required />
                        <Select label="Vehiculo" value={routeForm.vehicleId} onChange={(value) => setRouteForm({ ...routeForm, vehicleId: value })} options={data.vehicles.map((vehicle) => [vehicle.id, vehicle.plate])} required />
                        <TextArea label="Notas" value={routeForm.notes} onChange={(value) => setRouteForm({ ...routeForm, notes: value })} className="sm:col-span-2" />
                      </div>
                      <div className="border border-border bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700">Pedidos confirmados</p>
                          <span className="text-xs text-slate-500">{routeForm.orderIds.length} seleccionados</span>
                        </div>
                        <Table
                          headers={['Asignar', 'Cliente', 'Estado', 'Total', 'Direccion']}
                          rows={routeCandidateOrders.map((order) => [
                            <input
                              key={order.id}
                              type="checkbox"
                              checked={routeForm.orderIds.includes(order.id)}
                              onChange={(event) => toggleRouteOrder(order.id, event.target.checked)}
                              className="h-4 w-4 accent-primary"
                            />,
                            customerName(order.customer),
                            orderStatusLabel(order.status),
                            order.total,
                            order.deliveryStreet ?? ''
                          ])}
                        />
                        {!canCreateRoute ? (
                          <p className="mt-3 text-sm font-medium text-amber-700">{routeCreationMessage}</p>
                        ) : null}
                      </div>
                      <div className="flex justify-end gap-2">
                        {editingRouteId ? (
                          <button
                            type="button"
                            onClick={resetRouteForm}
                            className="h-10 border border-border bg-white px-4 text-sm font-semibold hover:border-primary"
                          >
                            Cancelar edicion
                          </button>
                        ) : null}
                        <PrimaryButton disabled={!canCreateRoute}>
                          {editingRouteId ? 'Actualizar ruta y pedidos' : 'Crear ruta y asignar pedidos'}
                        </PrimaryButton>
                      </div>
                    </form>
                    <div className="min-w-0">
                      <Table
                        headers={['Ruta', 'Fecha', 'Chofer', 'Vehiculo', 'Estado', 'Paradas', 'Cobros', 'Facturas', 'Acciones']}
                        rows={data.deliveryRoutes.map((route) => [
                          route.name,
                          route.routeDate.slice(0, 10),
                          `${route.driver.user.firstName} ${route.driver.user.lastName}`,
                          route.vehicle.plate,
                          routeStatusLabel(route.status),
                          <RouteStopsSummary key={`${route.id}-stops`} route={route} />,
                          <RoutePaymentsSummary key={`${route.id}-payments`} route={route} />,
                          <RouteInvoicesSummary key={`${route.id}-invoices`} route={route} />,
                          <RouteActions
                            key={route.id}
                            route={route}
                            onView={() => setSelectedRouteId(route.id)}
                            onEdit={() => editDeliveryRoute(route)}
                            onPrepare={() => void runRouteAction(route.id, 'prepare')}
                            onLoad={() => void runRouteAction(route.id, 'load-vehicle')}
                            onClose={() => void runRouteAction(route.id, 'close-preliminary')}
                            onCancel={() => void runRouteAction(route.id, 'cancel')}
                          />
                        ])}
                      />
                      {selectedRouteId ? <RouteDetailPanel route={data.deliveryRoutes.find((route) => route.id === selectedRouteId) ?? null} onClose={() => setSelectedRouteId(null)} /> : null}
                    </div>
                  </EntitySection>
                ) : null}
              </div>
            </Panel>
          </div>
        );
      }
      case 'ventas':
        return (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
            <Panel title={editingOrderId ? 'Editar pedido' : 'Nuevo pedido'} icon={<ShoppingCart size={18} />}>
              <form onSubmit={(event) => submitForm(event, saveOrder)} className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Cliente" value={orderForm.customerId} onChange={updateOrderCustomer} options={data.customers.map((customer) => [customer.id, customerName(customer)])} required />
                  <Field label="Fecha entrega" type="datetime-local" value={orderForm.requestedDeliveryAt} onChange={(value) => setOrderForm({ ...orderForm, requestedDeliveryAt: value })} />
                  <Field label="Direccion entrega" value={orderForm.deliveryStreet} onChange={(value) => setOrderForm({ ...orderForm, deliveryStreet: value })} />
                  <Field label="Localidad" value={orderForm.deliveryCity} onChange={(value) => setOrderForm({ ...orderForm, deliveryCity: value })} />
                  <Field label="Provincia" value={orderForm.deliveryProvince} onChange={(value) => setOrderForm({ ...orderForm, deliveryProvince: value })} />
                  <Field label="Referencia" value={orderForm.deliveryReference} onChange={(value) => setOrderForm({ ...orderForm, deliveryReference: value })} />
                </div>
                {orderForm.customerId && !selectedOrderCustomerAddress ? (
                  <p className="text-sm font-medium text-amber-700">
                    Este cliente no tiene direccion cargada. Completa la direccion para este pedido o actualiza la ficha del cliente.
                  </p>
                ) : null}
                <div className="border border-border bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_90px_120px_auto]">
                    <Select label="Producto" value={orderForm.productId} onChange={updateOrderProduct} options={data.products.map((product) => [product.id, product.name])} />
                    <Field label="Cantidad" type="number" value={orderForm.quantity} onChange={(value) => setOrderForm({ ...orderForm, quantity: value })} />
                    <Field label="Precio" type="number" value={orderForm.unitPrice} onChange={(value) => setOrderForm({ ...orderForm, unitPrice: value })} />
                    <div className="flex items-end">
                      <button type="button" onClick={addOrderItem} className="h-10 bg-slate-900 px-3 text-sm font-semibold text-white">
                        Agregar
                      </button>
                    </div>
                  </div>
                  <Table
                    headers={['Producto', 'Cantidad', 'Precio', 'Subtotal', 'Acciones']}
                    rows={orderItems.map((item, index) => {
                      const product = data.products.find((current) => current.id === item.productId);
                      return [
                        product?.name ?? item.productId,
                        <input
                          key="quantity"
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateOrderItem(index, { quantity: event.target.value })}
                          className="h-8 w-20 border border-border px-2 text-sm"
                        />,
                        <input
                          key="price"
                          type="number"
                          value={item.unitPrice}
                          onChange={(event) => updateOrderItem(index, { unitPrice: event.target.value })}
                          className="h-8 w-24 border border-border px-2 text-sm"
                        />,
                        String(Number(item.quantity || 0) * Number(item.unitPrice || 0)),
                        <button key="remove" type="button" onClick={() => removeOrderItem(index)} className="border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">
                          Quitar
                        </button>
                      ];
                    })}
                  />
                  <div className="mt-3 flex justify-end text-sm">
                    <span className="font-semibold">Total preliminar: {orderDraftTotal().toFixed(2)}</span>
                  </div>
                </div>
                <TextArea label="Observaciones de entrega" value={orderForm.deliveryNotes} onChange={(value) => setOrderForm({ ...orderForm, deliveryNotes: value })} />
                <TextArea label="Notas internas" value={orderForm.notes} onChange={(value) => setOrderForm({ ...orderForm, notes: value })} />
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton>{editingOrderId ? 'Actualizar pedido' : 'Guardar pedido en borrador'}</PrimaryButton>
                  {editingOrderId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrderId(null);
                        setOrderItems([]);
                        setOrderForm({
                          customerId: '',
                          productId: '',
                          quantity: '1',
                          unitPrice: '',
                          requestedDeliveryAt: '',
                          deliveryStreet: '',
                          deliveryCity: '',
                          deliveryProvince: '',
                          deliveryReference: '',
                          deliveryNotes: '',
                          notes: ''
                        });
                      }}
                      className="h-10 border border-border px-4 text-sm font-semibold"
                    >
                      Cancelar edicion
                    </button>
                  ) : null}
                </div>
              </form>
            </Panel>
            <Panel title="Pedidos" icon={<FileText size={18} />}>
              <Table
                headers={['Pedido', 'Cliente', 'Estado', 'Items', 'Total', 'Direccion', 'Acciones']}
                rows={data.orders.map((order) => [
                  orderReference(order),
                  customerName(order.customer),
                  orderStatusLabel(order.status),
                  String(order.items.length),
                  order.total,
                  order.deliveryStreet ?? '',
                  <OrderActions
                    key={order.id}
                    order={order}
                    onEdit={() => editOrder(order)}
                    onConfirm={() => void confirmOrder(order.id)}
                    onCancel={() => void cancelOrder(order.id)}
                  />
                ])}
              />
            </Panel>
          </div>
        );
      case 'facturacion':
        return (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
            <Panel title="Registrar pago" icon={<CreditCard size={18} />}>
              <form onSubmit={(event) => submitForm(event, createPayment)} className="grid gap-3 sm:grid-cols-2">
                <Select label="Cliente" value={paymentForm.customerId} onChange={(value) => setPaymentForm({ ...paymentForm, customerId: value })} options={data.customers.map((customer) => [customer.id, customerName(customer)])} required />
                <Field label="Importe" type="number" value={paymentForm.amount} onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })} required />
                <Select label="Medio" value={paymentForm.method} onChange={(value) => setPaymentForm({ ...paymentForm, method: value })} options={[['CASH', 'Efectivo'], ['TRANSFER', 'Transferencia'], ['CARD', 'Tarjeta'], ['CHECK', 'Cheque'], ['OTHER', 'Otro']]} />
                <Field label="Referencia" value={paymentForm.reference} onChange={(value) => setPaymentForm({ ...paymentForm, reference: value })} />
                <TextArea label="Notas" value={paymentForm.notes} onChange={(value) => setPaymentForm({ ...paymentForm, notes: value })} className="sm:col-span-2" />
                <PrimaryButton>Guardar pago</PrimaryButton>
              </form>
            </Panel>
            <div className="grid gap-4">
              <Panel title="Facturas" icon={<FileText size={18} />}>
                <Table
                  headers={['Numero', 'Pedido', 'Cliente', 'Estado', 'Total', 'Pagado', 'Saldo']}
                  rows={data.invoices.map((invoice) => [
                    invoice.number,
                    orderReference(invoice.order),
                    customerName(invoice.customer),
                    invoiceStatusLabel(invoice.status),
                    invoice.total,
                    invoicePaidAmount(invoice),
                    invoice.balance
                  ])}
                />
              </Panel>
              <Panel title="Pagos" icon={<CreditCard size={18} />}>
                <Table
                  headers={['Cliente', 'Pedido / factura', 'Importe', 'Medio', 'Sin aplicar', 'Acciones']}
                  rows={data.payments.map((payment) => [
                    customerName(payment.customer),
                    <PaymentAllocations key={payment.id} payment={payment} />,
                    payment.amount,
                    paymentMethodLabel(payment.method),
                    payment.unappliedAmount,
                    Number(payment.unappliedAmount) > 0 ? (
                      <button key={payment.id} type="button" onClick={() => void applyOpenInvoices(payment.id)} className="border border-primary/30 px-2 py-1 text-xs font-semibold text-primary hover:border-primary">
                        Aplicar a deuda
                      </button>
                    ) : (
                      ''
                    )
                  ])}
                />
              </Panel>
            </div>
          </div>
        );
      case 'activos': {
        const assetTabs: TabItem<AssetsTabKey>[] = [
          { key: 'containers', label: 'Envases', icon: <Boxes size={16} />, count: data.containerTypes.length },
          { key: 'movements', label: 'Movimientos', icon: <FileText size={16} />, count: data.containerMovements.length },
          { key: 'balances', label: 'Saldos', icon: <Users size={16} />, count: data.containerBalances.length },
          { key: 'equipment', label: 'Equipos', icon: <Package size={16} />, count: data.dispensers.length },
          { key: 'models', label: 'Modelos', icon: <Settings size={16} />, count: data.dispenserModels.length },
          { key: 'loans', label: 'Comodatos', icon: <FileText size={16} />, count: data.dispenserComodatos.length }
        ];
        const activeComodatoDispenserIds = new Set(
          data.dispenserComodatos
            .filter((comodato) => comodato.status === 'ACTIVE')
            .map((comodato) => comodato.dispenser.id)
        );
        const availableDispensers = data.dispensers.filter(
          (dispenser) =>
            !activeComodatoDispenserIds.has(dispenser.id) &&
            dispenser.status !== 'MAINTENANCE' &&
            dispenser.status !== 'RETIRED'
        );

        return (
          <div className="grid gap-4">
            <Panel title="Activos retornables y comodatos" icon={<Boxes size={18} />}>
              <AdminTabs tabs={assetTabs} activeKey={activeAssetsTab} onChange={setActiveAssetsTab} />
              <div className="mt-5">
                {activeAssetsTab === 'containers' ? (
                  <EntitySection title={editingContainerTypeId ? 'Editar tipo de envase' : 'Nuevo tipo de envase'} tableTitle="Tipos de envase cargados">
                    <form onSubmit={(event) => submitForm(event, createContainerType)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Nombre" value={containerTypeForm.name} onChange={(value) => setContainerTypeForm({ ...containerTypeForm, name: value })} required />
                        <Field label="Codigo" value={containerTypeForm.code} onChange={(value) => setContainerTypeForm({ ...containerTypeForm, code: value })} />
                        <Field label="Capacidad" type="number" value={containerTypeForm.capacity} onChange={(value) => setContainerTypeForm({ ...containerTypeForm, capacity: value })} />
                      </div>
                      <div className="flex justify-end">
                        {editingContainerTypeId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContainerTypeId(null);
                              setContainerTypeForm({ name: '', code: '', capacity: '' });
                            }}
                            className="h-10 border border-border bg-white px-4 text-sm font-semibold hover:border-primary"
                          >
                            Cancelar edicion
                          </button>
                        ) : null}
                        <PrimaryButton>{editingContainerTypeId ? 'Actualizar envase' : 'Guardar envase'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Envase', 'Codigo', 'Capacidad', 'Estado', 'Acciones']}
                      rows={data.containerTypes.map((type) => [
                        type.name,
                        type.code ?? '',
                        type.capacity ?? '',
                        type.active ? 'Activo' : 'Inactivo',
                        <ActionButtons
                          key={type.id}
                          onEdit={() => {
                            setEditingContainerTypeId(type.id);
                            setContainerTypeForm({ name: type.name, code: type.code ?? '', capacity: type.capacity ? String(type.capacity) : '' });
                          }}
                          onDeactivate={() => void deactivateContainerType(type.id)}
                          disabled={!type.active}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeAssetsTab === 'movements' ? (
                  <EntitySection title="Registrar movimiento de envases" tableTitle="Ultimos movimientos">
                    <form onSubmit={(event) => submitForm(event, createContainerMovement)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label="Cliente" value={containerMovementForm.customerId} onChange={(value) => setContainerMovementForm({ ...containerMovementForm, customerId: value })} options={data.customers.map((customer) => [customer.id, customerName(customer)])} required />
                        <Select label="Envase" value={containerMovementForm.containerTypeId} onChange={(value) => setContainerMovementForm({ ...containerMovementForm, containerTypeId: value })} options={data.containerTypes.map((type) => [type.id, type.name])} required />
                        <Select label="Tipo" value={containerMovementForm.type} onChange={(value) => setContainerMovementForm({ ...containerMovementForm, type: value })} options={[['DELIVERED', 'Entregado al cliente'], ['RETURNED', 'Recuperado del cliente'], ['ADJUSTMENT', 'Ajuste manual']]} required />
                        <Field label="Cantidad" type="number" value={containerMovementForm.quantity} onChange={(value) => setContainerMovementForm({ ...containerMovementForm, quantity: value })} required />
                        <Field label="Referencia" value={containerMovementForm.reference} onChange={(value) => setContainerMovementForm({ ...containerMovementForm, reference: value })} />
                        <Field label="Notas" value={containerMovementForm.notes} onChange={(value) => setContainerMovementForm({ ...containerMovementForm, notes: value })} />
                      </div>
                      <div className="flex justify-end">
                        <PrimaryButton>Guardar movimiento</PrimaryButton>
                      </div>
                    </form>
                    <>
                      <div className="mb-5">
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Saldos actuales</h3>
                        <Table
                          headers={['Cliente', 'Envase', 'Envases en poder del cliente', 'Acciones']}
                          rows={data.containerBalances.map((balance) => [
                            customerName(balance.customer),
                            balance.containerType.name,
                            <span key={`${balance.id}-balance`} className={balance.balance < 0 ? 'font-semibold text-red-700' : ''}>
                              {balance.balance < 0 ? `Revisar saldo (${balance.balance})` : String(balance.balance)}
                            </span>,
                            balance.balance > 0 ? (
                              <button
                                key={`${balance.id}-return`}
                                type="button"
                                onClick={() =>
                                  setContainerMovementForm((current) => ({
                                    ...current,
                                    customerId: balance.customer.id,
                                    containerTypeId: balance.containerType.id,
                                    type: 'RETURNED',
                                    quantity: '1'
                                  }))
                                }
                                className="border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-500"
                              >
                                Devolucion
                              </button>
                            ) : (
                              <span key={`${balance.id}-no-return`} className="text-xs text-slate-500">Sin envases</span>
                            )
                          ])}
                        />
                      </div>
                      <Table
                        headers={['Fecha', 'Cliente', 'Envase', 'Tipo', 'Movimiento', 'Referencia']}
                        rows={data.containerMovements.map((movement) => [
                          movement.createdAt?.slice(0, 10) ?? '',
                          customerName(movement.customer),
                          movement.containerType.name,
                          containerMovementLabel(movement.type),
                          signedQuantity(containerMovementDelta(movement.type, movement.quantity)),
                          movement.reference ?? ''
                        ])}
                      />
                    </>
                  </EntitySection>
                ) : null}
                {activeAssetsTab === 'balances' ? (
                  <EntitySection title="Envases en poder de clientes" tableTitle="Saldos por cliente">
                    <div className="border border-border bg-slate-50 p-3 text-sm text-slate-600">
                      Saldo positivo significa envases en poder del cliente.
                    </div>
                    <Table
                      headers={['Cliente', 'Envase', 'Saldo']}
                      rows={data.containerBalances.map((balance) => [customerName(balance.customer), balance.containerType.name, String(balance.balance)])}
                    />
                  </EntitySection>
                ) : null}
                {activeAssetsTab === 'equipment' ? (
                  <EntitySection title={editingDispenserId ? 'Editar equipo / dispenser' : 'Nuevo equipo / dispenser'} tableTitle="Equipos registrados">
                    <form onSubmit={(event) => submitForm(event, createDispenser)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label="Modelo" value={dispenserForm.modelId} onChange={(value) => setDispenserForm({ ...dispenserForm, modelId: value })} options={data.dispenserModels.map((model) => [model.id, model.name])} required />
                        <Field label="Numero de serie" value={dispenserForm.serialNumber} onChange={(value) => setDispenserForm({ ...dispenserForm, serialNumber: value })} required />
                        <Field label="Fecha compra" type="date" value={dispenserForm.acquiredAt} onChange={(value) => setDispenserForm({ ...dispenserForm, acquiredAt: value })} />
                        <Field label="Notas" value={dispenserForm.notes} onChange={(value) => setDispenserForm({ ...dispenserForm, notes: value })} />
                      </div>
                      <div className="flex justify-end">
                        {editingDispenserId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDispenserId(null);
                              setDispenserForm((current) => ({ modelId: current.modelId, serialNumber: '', acquiredAt: '', notes: '' }));
                            }}
                            className="h-10 border border-border bg-white px-4 text-sm font-semibold hover:border-primary"
                          >
                            Cancelar edicion
                          </button>
                        ) : null}
                        <PrimaryButton>{editingDispenserId ? 'Actualizar equipo' : 'Guardar equipo'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Serie', 'Modelo', 'Estado', 'Cliente actual', 'Acciones']}
                      rows={data.dispensers.map((dispenser) => [
                        dispenser.serialNumber,
                        dispenser.model.name,
                        dispenserStatusLabel(dispenser.status),
                        dispenser.currentCustomer ? customerName(dispenser.currentCustomer) : '',
                        <div key={dispenser.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDispenserId(dispenser.id);
                              setDispenserForm({
                                modelId: dispenser.model.id,
                                serialNumber: dispenser.serialNumber,
                                acquiredAt: '',
                                notes: ''
                              });
                            }}
                            className="border border-border px-2 py-1 text-xs font-semibold hover:border-primary"
                          >
                            Editar
                          </button>
                          {dispenser.status !== 'RETIRED' ? (
                            <button
                              type="button"
                              onClick={() => void retireDispenser(dispenser.id)}
                              disabled={dispenser.status === 'ON_LOAN'}
                              className="border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:border-red-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                            >
                              Dar de baja
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void reactivateDispenser(dispenser.id)}
                              className="border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-500"
                            >
                              Reactivar
                            </button>
                          )}
                        </div>
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeAssetsTab === 'models' ? (
                  <EntitySection title={editingDispenserModelId ? 'Editar modelo de equipo' : 'Nuevo modelo de equipo'} tableTitle="Modelos cargados">
                    <form onSubmit={(event) => submitForm(event, createDispenserModel)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Nombre" value={dispenserModelForm.name} onChange={(value) => setDispenserModelForm({ ...dispenserModelForm, name: value })} required />
                        <Field label="Codigo" value={dispenserModelForm.code} onChange={(value) => setDispenserModelForm({ ...dispenserModelForm, code: value })} />
                        <Field label="Capacidad" type="number" value={dispenserModelForm.capacity} onChange={(value) => setDispenserModelForm({ ...dispenserModelForm, capacity: value })} />
                      </div>
                      <div className="flex justify-end">
                        {editingDispenserModelId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDispenserModelId(null);
                              setDispenserModelForm({ name: '', code: '', capacity: '' });
                            }}
                            className="h-10 border border-border bg-white px-4 text-sm font-semibold hover:border-primary"
                          >
                            Cancelar edicion
                          </button>
                        ) : null}
                        <PrimaryButton>{editingDispenserModelId ? 'Actualizar modelo' : 'Guardar modelo'}</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Modelo', 'Codigo', 'Capacidad', 'Estado', 'Acciones']}
                      rows={data.dispenserModels.map((model) => [
                        model.name,
                        model.code ?? '',
                        model.capacity ?? '',
                        model.active ? 'Activo' : 'Inactivo',
                        <ActionButtons
                          key={model.id}
                          onEdit={() => {
                            setEditingDispenserModelId(model.id);
                            setDispenserModelForm({ name: model.name, code: model.code ?? '', capacity: model.capacity ? String(model.capacity) : '' });
                          }}
                          onDeactivate={() => void deactivateDispenserModel(model.id)}
                          disabled={!model.active}
                        />
                      ])}
                    />
                  </EntitySection>
                ) : null}
                {activeAssetsTab === 'loans' ? (
                  <EntitySection title="Nuevo comodato" tableTitle="Comodatos registrados">
                    <form onSubmit={(event) => submitForm(event, createDispenserComodato)} className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label="Equipo disponible" value={dispenserComodatoForm.dispenserId} onChange={(value) => setDispenserComodatoForm({ ...dispenserComodatoForm, dispenserId: value })} options={availableDispensers.map((dispenser) => [dispenser.id, `${dispenser.serialNumber} - ${dispenser.model.name}`])} required />
                        <Select label="Cliente" value={dispenserComodatoForm.customerId} onChange={(value) => setDispenserComodatoForm({ ...dispenserComodatoForm, customerId: value })} options={data.customers.map((customer) => [customer.id, customerName(customer)])} required />
                        <Field label="Fecha entrega" type="date" value={dispenserComodatoForm.deliveredAt} onChange={(value) => setDispenserComodatoForm({ ...dispenserComodatoForm, deliveredAt: value })} />
                        <Field label="Deposito garantia" type="number" value={dispenserComodatoForm.depositAmount} onChange={(value) => setDispenserComodatoForm({ ...dispenserComodatoForm, depositAmount: value })} />
                        <Field label="Notas" value={dispenserComodatoForm.notes} onChange={(value) => setDispenserComodatoForm({ ...dispenserComodatoForm, notes: value })} />
                      </div>
                      {!availableDispensers.length ? <p className="text-sm font-medium text-amber-700">No hay equipos disponibles para comodato.</p> : null}
                      <div className="flex justify-end">
                        <PrimaryButton disabled={!availableDispensers.length}>Guardar comodato</PrimaryButton>
                      </div>
                    </form>
                    <Table
                      headers={['Equipo', 'Cliente', 'Entrega', 'Estado', 'Garantia', 'Acciones']}
                      rows={data.dispenserComodatos.map((comodato) => [
                        `${comodato.dispenser.serialNumber} - ${comodato.dispenser.model.name}`,
                        customerName(comodato.customer),
                        comodato.deliveredAt.slice(0, 10),
                        comodatoStatusLabel(comodato.status),
                        comodato.depositAmount ?? '',
                        comodato.status === 'ACTIVE' ? (
                          <button key={comodato.id} type="button" onClick={() => void retireDispenserComodato(comodato)} className="border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-500">
                            Registrar devolucion
                          </button>
                        ) : (
                          ''
                        )
                      ])}
                    />
                  </EntitySection>
                ) : null}
              </div>
            </Panel>
          </div>
        );
      }
      case 'admin':
        return (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Usuario" icon={<Users size={18} />}>
              <form onSubmit={(event) => submitForm(event, createUser)} className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" type="email" value={userForm.email} onChange={(value) => setUserForm({ ...userForm, email: value })} required />
                <Field label="Password" type="password" value={userForm.password} onChange={(value) => setUserForm({ ...userForm, password: value })} required />
                <Field label="Nombre" value={userForm.firstName} onChange={(value) => setUserForm({ ...userForm, firstName: value })} required />
                <Field label="Apellido" value={userForm.lastName} onChange={(value) => setUserForm({ ...userForm, lastName: value })} required />
                <Select label="Rol" value={userForm.roleId} onChange={(value) => setUserForm({ ...userForm, roleId: value })} options={data.roles.map((role) => [role.id, role.name])} />
                <PrimaryButton>{editingUserId ? 'Actualizar usuario' : 'Guardar usuario'}</PrimaryButton>
              </form>
              <Table
                headers={['Usuario', 'Email', 'Estado', 'Roles', 'Acciones']}
                rows={data.users.map((user) => [
                  `${user.firstName} ${user.lastName}`,
                  user.email,
                  user.status,
                  user.userRoles.map((item) => item.role.name).join(', '),
                  <ActionButtons
                    key={user.id}
                    onEdit={() => {
                      setEditingUserId(user.id);
                      setUserForm({
                        email: user.email,
                        password: 'Admin123!',
                        firstName: user.firstName,
                        lastName: user.lastName,
                        roleId: user.userRoles[0]?.role.id ?? ''
                      });
                    }}
                    onDeactivate={() => void deactivate(`/users/${user.id}`, { status: 'DISABLED' })}
                    disabled={user.status !== 'ACTIVE'}
                  />
                ])}
              />
            </Panel>
            <Panel title="Rol" icon={<Settings size={18} />}>
              <form onSubmit={(event) => submitForm(event, createRole)} className="grid gap-3">
                <Field label="Nombre" value={roleForm.name} onChange={(value) => setRoleForm({ ...roleForm, name: value })} required />
                <TextArea label="Descripcion" value={roleForm.description} onChange={(value) => setRoleForm({ ...roleForm, description: value })} />
                <div className="grid max-h-56 gap-2 overflow-auto border border-border p-3">
                  {data.permissions.map((permission) => (
                    <Check
                      key={permission.code}
                      label={permission.code}
                      checked={roleForm.permissionCodes.includes(permission.code)}
                      onChange={(checked) =>
                        setRoleForm({
                          ...roleForm,
                          permissionCodes: checked
                            ? [...roleForm.permissionCodes, permission.code]
                            : roleForm.permissionCodes.filter((code) => code !== permission.code)
                        })
                      }
                    />
                  ))}
                </div>
                <PrimaryButton>{editingRoleId ? 'Actualizar rol' : 'Guardar rol'}</PrimaryButton>
              </form>
              <Table
                headers={['Rol', 'Permisos', 'Acciones']}
                rows={data.roles.map((role) => [
                  role.name,
                  String(role.rolePermissions.length),
                  <ActionButtons
                    key={role.id}
                    onEdit={() => {
                      setEditingRoleId(role.id);
                      setRoleForm({
                        name: role.name,
                        description: role.description ?? '',
                        permissionCodes: role.rolePermissions.map((item) => item.permission.code)
                      });
                    }}
                  />
                ])}
              />
            </Panel>
          </div>
        );
      case 'reportes':
        return (
          <div className="grid gap-4 xl:grid-cols-3">
            <MiniMetric label="Ventas" value={String(data.kpis?.sales.amount ?? 0)} />
            <MiniMetric label="Cobranzas" value={String(data.kpis?.collections.amount ?? 0)} />
            <MiniMetric label="Deuda" value={String(data.kpis?.debt.amount ?? 0)} />
            <Panel title="Productos mas vendidos" icon={<BarChart3 size={18} />} className="xl:col-span-3">
              <Table
                headers={['Producto', 'Cantidad', 'Importe']}
                rows={(data.kpis?.products.top ?? []).map((item) => [item.name, String(item.quantity), String(item.amount)])}
              />
            </Panel>
          </div>
        );
      default:
        return (
          <div className="grid gap-4 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
            <Panel title="Estado del sistema" icon={<LayoutDashboard size={18} />} className="xl:col-span-2">
              <div className="grid gap-3 text-sm">
                <StatusLine label="API" value={data.health?.services.api ?? 'sin datos'} />
                <StatusLine label="Base de datos" value={data.health?.services.database ?? 'sin datos'} />
                <StatusLine label="Storage" value={data.health?.services.storage.provider ?? 'sin datos'} />
              </div>
            </Panel>
            <Panel title="Actividad comercial" icon={<ShoppingCart size={18} />} className="xl:col-span-2">
              <Table
                headers={['Pedido', 'Cliente', 'Estado', 'Total']}
                rows={data.orders.slice(0, 6).map((order) => [orderReference(order), customerName(order.customer), orderStatusLabel(order.status), order.total])}
              />
            </Panel>
          </div>
        );
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="group fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-slate-200 bg-slate-950 text-white transition-all duration-200 hover:w-64">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center bg-primary font-semibold">AD</div>
          <div className="min-w-0 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate text-sm font-semibold">Agua Distri</p>
            <p className="truncate text-xs text-slate-400">{session.user.email}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveModule(item.key)}
              className={`flex h-11 w-full items-center gap-3 px-3 text-left text-sm transition ${
                activeModule === item.key ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              title={item.label}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center">{item.icon}</span>
              <span className="min-w-0 flex-1 truncate opacity-0 transition-opacity group-hover:opacity-100">{item.label}</span>
              <ChevronRight className="opacity-0 group-hover:opacity-70" size={16} />
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          className="m-2 flex h-11 items-center gap-3 px-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
          title="Salir"
        >
          <LogOut size={19} />
          <span className="opacity-0 transition-opacity group-hover:opacity-100">Salir</span>
        </button>
      </aside>

      <main className="pl-16">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-primary">Backoffice</p>
              <h1 className="text-2xl font-semibold">{navItems.find((item) => item.key === activeModule)?.label ?? 'Inicio'}</h1>
            </div>
            <div className="flex items-center gap-2">
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="button"
                onClick={() => void loadData()}
                className="inline-flex h-10 items-center gap-2 border border-border bg-white px-3 text-sm font-semibold hover:border-primary"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>
          </div>
        </header>
        <section className="p-6">{renderActiveModule()}</section>
      </main>
    </div>
  );
}

function customerName(customer: Customer): string {
  return customer.businessName ?? (`${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || 'Sin nombre');
}

function customerAddressLabel(customer: Customer): string {
  const address = customer.addresses?.[0];
  if (!address) return '';

  return [address.street, address.city, address.province, address.reference ? `Ref: ${address.reference}` : '']
    .filter(Boolean)
    .join(' - ');
}

function slugFromName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function adminEmailFromSlug(slug: string): string {
  return slug ? `admin@${slug}.local` : '';
}

function tenantStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Activa',
    SUSPENDED: 'Suspendida',
    INACTIVE: 'Inactiva'
  };
  return labels[status] ?? status;
}

function orderReference(order?: Order | null): string {
  return order ? `Pedido #${order.id.slice(-8)}` : 'Sin pedido';
}

function invoicePaidAmount(invoice: Invoice): string {
  return (Number(invoice.total) - Number(invoice.balance)).toFixed(2).replace(/\.00$/, '');
}

function routeStopTotal(stop: DeliveryRoute['orders'][number]): number {
  const deliveredTotal = stop.deliveredItems?.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0) ?? 0;
  return deliveredTotal > 0 ? deliveredTotal : Number(stop.order.total ?? 0);
}

function formatMoney(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('401') || error.message.toLowerCase().includes('token');
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(window.atob(token.split('.')[1] ?? '')) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return false;
  }
}

function routeStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    PREPARED: 'Preparada',
    LOADED: 'Cargada',
    CLOSED_PRELIMINARY: 'Cierre preliminar',
    CANCELLED: 'Cancelada'
  };
  return labels[status] ?? status;
}

function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    CONFIRMED: 'Confirmado',
    ASSIGNED: 'Asignado',
    DELIVERED: 'Entregado',
    FAILED_DELIVERY: 'Entrega fallida',
    CANCELLED: 'Cancelado'
  };
  return labels[status] ?? status;
}

function stopStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    DELIVERED: 'Entregada',
    FAILED: 'Fallida'
  };
  return labels[status] ?? status;
}

function invoiceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ISSUED: 'Pendiente',
    PARTIALLY_PAID: 'Pago parcial',
    PAID: 'Pagada',
    VOID: 'Anulada'
  };
  return labels[status] ?? status;
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'efectivo',
    TRANSFER: 'transferencia',
    CARD: 'tarjeta',
    CHECK: 'cheque',
    OTHER: 'otro'
  };
  return labels[method] ?? method;
}

function containerMovementLabel(type: string): string {
  const labels: Record<string, string> = {
    DELIVERED: 'Entregado',
    RETURNED: 'Recuperado',
    ADJUSTMENT: 'Ajuste'
  };
  return labels[type] ?? type;
}

function containerMovementDelta(type: string, quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  if (type === 'RETURNED') return -quantity;
  return quantity;
}

function currentContainerBalance(balances: ContainerBalance[], customerId: string, containerTypeId: string): number {
  return balances.find((balance) => balance.customer.id === customerId && balance.containerType.id === containerTypeId)?.balance ?? 0;
}

function signedQuantity(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function dispenserStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    AVAILABLE: 'Disponible',
    ON_LOAN: 'En comodato',
    MAINTENANCE: 'Mantenimiento',
    RETIRED: 'Retirado'
  };
  return labels[status] ?? status;
}

function comodatoStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Activo',
    RETURNED: 'Devuelto',
    CANCELLED: 'Cancelado'
  };
  return labels[status] ?? status;
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: FieldProps) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        required={required}
        className="h-10 min-w-0 border border-border bg-white px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="h-10 min-w-0 border border-border bg-white px-3 text-sm outline-none focus:border-primary"
      >
        <option value="">{label === 'Lista de precios' ? 'Sin lista - precio base' : 'Seleccionar'}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  className = ''
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="min-w-0 resize-y border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}

function PrimaryButton({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="h-10 bg-primary px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300"
    >
      {children}
    </button>
  );
}

function ActionButtons({
  onEdit,
  onDeactivate,
  disabled = false,
  deactivateLabel = 'Desactivar'
}: {
  onEdit: () => void;
  onDeactivate?: () => void;
  disabled?: boolean;
  deactivateLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onEdit} className="border border-border px-2 py-1 text-xs font-semibold hover:border-primary">
        Editar
      </button>
      {onDeactivate ? (
        <button
          type="button"
          onClick={onDeactivate}
          disabled={disabled}
          className="border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deactivateLabel}
        </button>
      ) : null}
    </div>
  );
}

function OrderActions({
  order,
  onEdit,
  onConfirm,
  onCancel
}: {
  order: Order;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {order.status !== 'ASSIGNED' && order.status !== 'CANCELLED' ? (
        <button type="button" onClick={onEdit} className="border border-border px-2 py-1 text-xs font-semibold hover:border-primary">
          Editar
        </button>
      ) : null}
      {order.status === 'DRAFT' ? (
        <button type="button" onClick={onConfirm} className="border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-500">
          Confirmar
        </button>
      ) : null}
      {order.status !== 'CANCELLED' && order.status !== 'ASSIGNED' ? (
        <button type="button" onClick={onCancel} className="border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:border-red-500">
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

function RouteActions({
  route,
  onView,
  onEdit,
  onPrepare,
  onLoad,
  onClose,
  onCancel
}: {
  route: DeliveryRoute;
  onView: () => void;
  onEdit: () => void;
  onPrepare: () => void;
  onLoad: () => void;
  onClose: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onView} className="border border-border px-2 py-1 text-xs font-semibold hover:border-primary">
        Ver
      </button>
      {route.status === 'DRAFT' ? (
        <button type="button" onClick={onEdit} className="border border-border px-2 py-1 text-xs font-semibold hover:border-primary">
          Editar
        </button>
      ) : null}
      {route.status === 'DRAFT' ? (
        <button type="button" onClick={onPrepare} className="border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-500">
          Preparar
        </button>
      ) : null}
      {route.status === 'PREPARED' ? (
        <button type="button" onClick={onLoad} className="border border-primary/30 px-2 py-1 text-xs font-semibold text-primary hover:border-primary">
          Cargar
        </button>
      ) : null}
      {route.status === 'LOADED' ? (
        <button type="button" onClick={onClose} className="border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-500">
          Cerrar
        </button>
      ) : null}
      {route.status === 'DRAFT' || route.status === 'PREPARED' ? (
        <button type="button" onClick={onCancel} className="border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:border-red-500">
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

function RouteStopsSummary({ route }: { route: DeliveryRoute }) {
  return (
    <div className="grid min-w-56 gap-1">
      {route.orders.map((item) => (
        <div key={item.id} className="min-w-0">
          <span className="font-medium">{item.sequence}. {customerName(item.order.customer)}</span>
          <span className="ml-1 text-slate-500">({stopStatusLabel(item.stopStatus)})</span>
          {item.failureReason ? <p className="truncate text-xs text-red-700">{item.failureReason}</p> : null}
        </div>
      ))}
    </div>
  );
}

function RoutePaymentsSummary({ route }: { route: DeliveryRoute }) {
  return (
    <div className="grid min-w-56 gap-1">
      {route.orders.map((item) => {
        const total = routeStopTotal(item);
        const collected = Number(item.collectedAmount ?? 0);
        const balance = Math.max(total - collected, 0);
        return (
          <div key={item.id} className="min-w-0">
            <p className="whitespace-nowrap">{item.sequence}. cobrado {formatMoney(collected)} {paymentMethodLabel(item.paymentMethod ?? 'CASH')}</p>
            <p className="text-xs text-slate-500">total {formatMoney(total)} · saldo {formatMoney(balance)}</p>
          </div>
        );
      })}
    </div>
  );
}

function RouteInvoicesSummary({ route }: { route: DeliveryRoute }) {
  return (
    <div className="grid min-w-52 gap-1">
      {route.orders.map((item) => {
        const invoice = item.invoices?.[0] ?? item.order.invoices?.[0];
        return (
          <div key={item.id} className="min-w-0">
            {invoice ? (
              <>
                <p className="truncate">{item.sequence}. {invoice.number} {invoiceStatusLabel(invoice.status)}</p>
                <p className="text-xs text-slate-500">saldo {invoice.balance}</p>
              </>
            ) : (
              <span className="whitespace-nowrap">{item.sequence}. sin factura</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RouteDetailPanel({ route, onClose }: { route: DeliveryRoute | null; onClose: () => void }) {
  if (!route) return null;
  const total = route.orders.reduce((sum, item) => sum + routeStopTotal(item), 0);
  const collected = route.orders.reduce((sum, item) => sum + Number(item.collectedAmount ?? 0), 0);
  const balance = Math.max(total - collected, 0);

  return (
    <section className="mt-4 border border-border bg-slate-50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Detalle de ruta</p>
          <h3 className="font-semibold">{route.name}</h3>
          <p className="text-sm text-slate-600">{routeStatusLabel(route.status)} · {route.vehicle.plate}</p>
        </div>
        <button type="button" onClick={onClose} className="border border-border bg-white px-2 py-1 text-xs font-semibold">
          Cerrar detalle
        </button>
      </div>
      <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="border border-border bg-white p-2">
          <p className="text-xs text-slate-500">Total ruta</p>
          <p className="font-semibold">{formatMoney(total)}</p>
        </div>
        <div className="border border-border bg-white p-2">
          <p className="text-xs text-slate-500">Cobrado en reparto</p>
          <p className="font-semibold">{formatMoney(collected)}</p>
        </div>
        <div className="border border-border bg-white p-2">
          <p className="text-xs text-slate-500">Saldo estimado</p>
          <p className="font-semibold">{formatMoney(balance)}</p>
        </div>
      </div>
      <Table
        headers={['Parada', 'Pedido', 'Cliente', 'Entrega', 'Total', 'Cobrado', 'Saldo', 'Factura']}
        rows={route.orders.map((item) => {
          const stopTotal = routeStopTotal(item);
          const stopCollected = Number(item.collectedAmount ?? 0);
          const stopBalance = Math.max(stopTotal - stopCollected, 0);
          const invoice = item.invoices?.[0] ?? item.order.invoices?.[0];
          return [
            `#${item.sequence}`,
            orderReference(item.order),
            customerName(item.order.customer),
            stopStatusLabel(item.stopStatus),
            formatMoney(stopTotal),
            `${formatMoney(stopCollected)} ${paymentMethodLabel(item.paymentMethod ?? 'CASH')}`,
            formatMoney(stopBalance),
            invoice ? `${invoice.number} ${invoiceStatusLabel(invoice.status)} saldo ${invoice.balance}` : route.status === 'LOADED' ? 'Pendiente de cierre' : 'Sin factura'
          ];
        })}
      />
    </section>
  );
}

function PaymentAllocations({ payment }: { payment: Payment }) {
  if (!payment.allocations?.length) return <span>Sin factura asignada</span>;

  return (
    <div className="grid min-w-56 gap-1">
      {payment.allocations.map((allocation) => (
        <div key={allocation.id} className="min-w-0">
          <p className="truncate">{orderReference(allocation.invoice.order)} / {allocation.invoice.number}</p>
          <p className="text-xs text-slate-500">
            total {allocation.invoice.total} · aplicado {allocation.amount} · saldo {allocation.invoice.balance}
          </p>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  className = ''
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-border bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function AdminTabs<TKey extends string>({
  tabs,
  activeKey,
  onChange
}: {
  tabs: TabItem<TKey>[];
  activeKey: TKey;
  onChange: (key: TKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`inline-flex h-10 items-center gap-2 border px-3 text-sm font-semibold ${
              active
                ? 'border-primary bg-cyan-50 text-primary'
                : 'border-border bg-white text-slate-600 hover:border-primary hover:text-primary'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              <span className={`min-w-6 px-1.5 py-0.5 text-center text-xs ${active ? 'bg-white text-primary' : 'bg-slate-100 text-slate-500'}`}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-sm font-semibold text-slate-800">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function EntitySection({
  title,
  tableTitle,
  children
}: {
  title: string;
  tableTitle: string;
  children: [React.ReactNode, React.ReactNode];
}) {
  const [form, table] = children;

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
        {form}
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{tableTitle}</h3>
        {table}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="border border-border bg-white p-4">
      <div className="mb-3 text-primary">{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-slate-500">
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap py-2 pr-4 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={`${row.join('|')}-${rowIndex}`} className="border-b border-border last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="max-w-80 py-2 pr-4 align-top text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="py-3 text-slate-500" colSpan={headers.length}>
                Sin datos
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
