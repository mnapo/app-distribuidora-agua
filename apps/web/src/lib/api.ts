export type SessionUser = {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  permissions: string[];
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  rolePermissions: { permission: Permission }[];
};

export type Permission = {
  id: string;
  code: string;
  description: string | null;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  adminUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  } | null;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  userRoles: { role: Role }[];
};

export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type Branch = {
  id: string;
  name: string;
  code: string | null;
  phone?: string | null;
  address?: string | null;
  active: boolean;
};

export type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  address?: string | null;
  active: boolean;
  branch?: Branch | null;
};

export type Customer = {
  id: string;
  type: string;
  businessName: string | null;
  firstName: string | null;
  lastName: string | null;
  taxId: string | null;
  phone: string | null;
  email?: string | null;
  creditLimit?: string | null;
  paymentTerms?: string | null;
  priceListId?: string | null;
  priceList?: PriceList | null;
  customerProductPrices?: {
    productId: string;
    price: string;
  }[];
  notes?: string | null;
  status: string;
  addresses?: {
    street: string;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    reference: string | null;
  }[];
};

export type ProductCategory = {
  id: string;
  name: string;
  active: boolean;
};

export type Product = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  unit: string;
  liters?: string | null;
  cost?: string | null;
  price: string;
  tax?: string | null;
  active: boolean;
  returnable?: boolean;
  requiresContainer?: boolean;
  category?: ProductCategory | null;
};

export type PriceList = {
  id: string;
  name: string;
  active: boolean;
  isDefault: boolean;
  items: {
    id?: string;
    productId: string;
    price: string;
    product?: Product;
  }[];
};

export type Vehicle = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year?: number | null;
  capacity?: string | null;
  status: string;
};

export type Driver = {
  id: string;
  status: string;
  licenseNumber: string | null;
  user: User;
};

export type InventoryItem = {
  id: string;
  quantity: string;
  locationType: string;
  product: Product;
  warehouse?: Warehouse | null;
  vehicle?: Vehicle | null;
};

export type Order = {
  id: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  total: string;
  deliveryStreet: string | null;
  customer: Customer;
  assignedDriver?: Driver | null;
  assignedVehicle?: Vehicle | null;
  items: { product: Product; quantity: string; unitPrice: string; lineTotal: string }[];
  invoices?: Invoice[];
};

export type DeliveryRoute = {
  id: string;
  name: string;
  routeDate: string;
  status: string;
  warehouse: Warehouse;
  driver: Driver;
  vehicle: Vehicle;
  orders: {
    id: string;
    sequence: number;
    stopStatus: string;
    failureReason?: string | null;
    observations?: string | null;
    collectedAmount: string;
    paymentMethod?: string;
    order: Order;
    invoices?: Invoice[];
    deliveredItems?: { product: Product; deliveredQuantity: string; lineTotal: string }[];
  }[];
};

export type DriverMobileRoute = {
  id: string;
  name: string;
  routeDate: string;
  status: string;
  vehicle: Vehicle;
  warehouse: Warehouse;
  orders: DriverMobileStop[];
};

export type DriverMobileStop = {
  id: string;
  sequence: number;
  stopStatus: string;
  observations: string | null;
  failureReason: string | null;
  collectedAmount: string;
  paymentMethod?: string;
  order: Order & {
    deliveryAddress?: {
      street: string;
      city: string | null;
      reference: string | null;
      latitude: string | null;
      longitude: string | null;
    } | null;
  };
  deliveredItems: { product: Product; deliveredQuantity: string; source: string }[];
};

export type ContainerType = {
  id: string;
  name: string;
  code: string | null;
  capacity?: string | number | null;
  active: boolean;
};

export type ContainerMovement = {
  id: string;
  type: string;
  quantity: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  customer: Customer;
  containerType: ContainerType;
};

export type ContainerBalance = {
  id: string;
  balance: number;
  customer: Customer;
  containerType: ContainerType;
};

export type Invoice = {
  id: string;
  number: string;
  status: string;
  total: string;
  balance: string;
  customer: Customer;
  order?: Order | null;
  items: unknown[];
  allocations?: { id: string; amount: string }[];
};

export type Payment = {
  id: string;
  amount: string;
  unappliedAmount: string;
  method: string;
  customer: Customer;
  allocations?: {
    id: string;
    amount: string;
    invoice: Invoice;
  }[];
};

export type RecurringOrderRuleItem = {
  id: string;
  productId: string;
  quantity: string;
  product?: Product;
};

export type RecurringOrderRule = {
  id: string;
  name: string;
  status: string;
  frequency: string;
  nextRunDate: string | null;
  customer: Customer;
  items: RecurringOrderRuleItem[];
};

export type SubscriptionPlanItem = {
  id: string;
  productId: string;
  includedQuantity: string;
  product?: Product;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: string;
  frequency: string;
  active: boolean;
  items: SubscriptionPlanItem[];
};

export type CustomerSubscription = {
  id: string;
  status: string;
  customer: Customer;
  plan: SubscriptionPlan;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

export type DispenserModel = {
  id: string;
  name: string;
  code: string | null;
  capacity?: string | number | null;
  active: boolean;
};

export type Dispenser = {
  id: string;
  serialNumber: string;
  status: string;
  model: DispenserModel;
  currentCustomer?: Customer | null;
};

export type DispenserComodato = {
  id: string;
  status: string;
  deliveredAt: string;
  returnedAt: string | null;
  depositAmount?: string | number | null;
  customer: Customer;
  dispenser: Dispenser;
};

export type ReportKpis = {
  sales: { amount: number; invoices: number };
  collections: { amount: number; payments: number };
  debt: { amount: number };
  customers: { total: number; active: number };
  routes: { total: number; deliveredStops: number };
  products: { active: number; top: { productId: string | null; name: string; quantity: number; amount: number }[] };
  containers: { balance: number };
  dispensers: Record<string, number>;
  liters: { delivered: number };
};

export type AlertRule = {
  id: string;
  name: string;
  type: string;
  severity: string;
  channel: string;
  active: boolean;
};

export type Alert = {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string;
  scheduledAt: string;
};

export type ExternalIntegration = {
  id: string;
  provider: string;
  name: string;
  status: string;
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  events: string;
  active: boolean;
};

export type PublicApiKey = {
  id: string;
  name: string;
  scopes: string;
  active: boolean;
};

export type Health = {
  status: string;
  services: {
    api: string;
    database: string;
    storage: {
      provider: string;
      root: string;
    };
  };
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const timeoutMs = 15_000;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(error?.message ?? `Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`La API no respondio en ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getApiUrl(): string {
  return apiUrl;
}
