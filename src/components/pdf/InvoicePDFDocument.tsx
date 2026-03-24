/**
 * Invoice PDF Document Component using @react-pdf/renderer
 * Beautiful, professional invoice design with logo support
 */

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { InvoiceData } from "@/types/invoice";
import { Order } from "@/types/order";
import { GRADE_LABELS } from "@/lib/constants/grades";

interface InvoicePDFDocumentProps {
  companyInfo: {
    name: string;
    address: string;
    hstNumber: string;
    logoUrl?: string | null;
  };
  customerInfo: {
    businessName?: string | null;
    businessAddress?: string | null;
    billingAddress?: string | null;
    shippingAddress?: string | null;
  };
  invoiceData: InvoiceData;
  order: Order;
}

// Register fonts (optional - using default Helvetica)
// You can add custom fonts here if needed

// Create styles
const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 30,
  },
  // Header Section
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  // Logo + company name side by side
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 110,
    height: 65,
    objectFit: "contain",
  },
  companyInfo: {
    flexDirection: "column",
    justifyContent: "center",
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 9,
    color: "#666666",
    lineHeight: 1.4,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
    marginBottom: 5,
  },
  invoiceDetails: {
    fontSize: 9,
    color: "#4b5563",
    marginBottom: 2,
  },
  invoiceDetailsBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginBottom: 2,
  },
  // Bill To / Ship To Section
  addressSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  addressBox: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    border: "1 solid #e5e7eb",
  },
  addressTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    marginBottom: 2,
  },
  addressName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginBottom: 1,
  },
  addressText: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  // Table Section
  table: {
    width: "100%",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #e5e7eb",
    padding: 10,
    minHeight: 35,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: "1 solid #e5e7eb",
    backgroundColor: "#fafafa",
    padding: 10,
    minHeight: 35,
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
  },
  // Column widths
  colItem: {
    width: "33%",
    paddingRight: 10,
  },
  colQuantity: {
    width: "10%",
    textAlign: "center",
  },
  colImei: {
    width: "22%",
    paddingLeft: 6,
    paddingRight: 8,
    overflow: "hidden",
  },
  colRate: {
    width: "17%",
    textAlign: "right",
    paddingRight: 10,
  },
  colAmount: {
    width: "18%",
    textAlign: "right",
  },
  // Summary Section
  summarySection: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  summaryBox: {
    width: 250,
    border: "1 solid #e5e7eb",
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10,
    borderBottom: "1 solid #e5e7eb",
  },
  summaryRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#4b5563",
  },
  summaryValue: {
    fontSize: 10,
    color: "#1f2937",
  },
  summaryLabelBold: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
  },
  summaryValueBold: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#2563eb",
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  totalValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  // Balance Due Box
  balanceDueBox: {
    width: 250,
    backgroundColor: "#fef3c7",
    border: "2 solid #fbbf24",
    borderRadius: 4,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceDueLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#78350f",
  },
  balanceDueValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#78350f",
  },
  // Footer Section
  footer: {
    marginTop: 24,
  },
  footerSection: {
    marginBottom: 20,
  },
  footerTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 6,
  },
  footerText: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  hstText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginTop: 10,
  },
});

/**
 * Format price for display
 */
const formatPrice = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

/**
 * Format date for display
 */
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

/**
 * Invoice PDF Document Component
 */
export const InvoicePDFDocument = ({
  companyInfo,
  customerInfo,
  invoiceData,
  order,
}: InvoicePDFDocumentProps) => {
  // Prepare table data (include IMEI per line item, keyed by index)
  const tableRows = Array.isArray(order.items)
    ? order.items.map((orderItem, index) => {
        if (orderItem?.item) {
          const gradeLabel =
            GRADE_LABELS[orderItem.item.grade as keyof typeof GRADE_LABELS] ??
            orderItem.item.grade;
          const itemName = `${orderItem.item.deviceName} (${gradeLabel}) ${orderItem.item.storage}`;
          const quantity = orderItem.quantity;
          const itemPrice =
            orderItem.item.sellingPrice ?? orderItem.item.pricePerUnit;
          const rate = itemPrice;
          const amount = itemPrice * orderItem.quantity;
          const rawImei = order.imeiNumbers?.[String(index)]?.trim() || "";
          const imeiList = rawImei
            ? rawImei.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
          return { itemName, quantity, rate, amount, imeiList };
        }
        return null;
      })
    : [];

  // Filter out null values
  const validRows = tableRows.filter((row) => row !== null) as Array<{
    itemName: string;
    quantity: number;
    rate: number;
    amount: number;
    imeiList: string[];
  }>;

  // Calculate financial summary
  const discount = order.discountAmount || 0;
  const shipping = order.shippingAmount || 0;
  const result = order.subtotal - discount + shipping;
  const finalTotal = order.totalPrice;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            {companyInfo.logoUrl && (
              <Image style={styles.logo} src={companyInfo.logoUrl} />
            )}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{companyInfo.name}</Text>
              <Text style={styles.companyAddress}>{companyInfo.address}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceDetailsBold}>
              # {invoiceData.invoiceNumber}
            </Text>
            <Text style={styles.invoiceDetails}>
              Date: {formatDate(invoiceData.invoiceDate)}
            </Text>
            <Text style={styles.invoiceDetails}>
              Payment Terms: {invoiceData.paymentTerms}
            </Text>
            <Text style={styles.invoiceDetails}>
              Due Date: {formatDate(invoiceData.dueDate)}
            </Text>
            <Text style={styles.invoiceDetails}>
              PO Number: {invoiceData.poNumber}
            </Text>
          </View>
        </View>

        {/* Bill To / Ship To Section */}
        <View style={styles.addressSection}>
          <View style={styles.addressBox}>
            <Text style={styles.addressTitle}>BILL TO:</Text>
            <Text style={styles.addressName}>
              {customerInfo.businessName || "Customer"}
            </Text>
            {customerInfo.businessAddress && (
              <Text style={styles.addressText}>
                {customerInfo.businessAddress}
              </Text>
            )}
            {customerInfo.billingAddress && (
              <Text style={[styles.addressText, { marginTop: 3 }]}>
                {customerInfo.billingAddress}
              </Text>
            )}
          </View>
          <View style={styles.addressBox}>
            <Text style={styles.addressTitle}>SHIP TO:</Text>
            <Text style={styles.addressName}>
              {customerInfo.businessName || "Customer"}
            </Text>
            {customerInfo.businessAddress && (
              <Text style={styles.addressText}>
                {customerInfo.businessAddress}
              </Text>
            )}
            {customerInfo.shippingAddress && (
              <Text style={[styles.addressText, { marginTop: 3 }]}>
                {customerInfo.shippingAddress}
              </Text>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
            <Text style={[styles.tableHeaderCell, styles.colQuantity]}>
              Qty
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colImei]}>IMEI</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>
              Amount
            </Text>
          </View>

          {/* Table Rows */}
          {validRows.map((row, index) => (
            <View
              key={index}
              style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={[styles.tableCellBold, styles.colItem]}>
                {row.itemName}
              </Text>
              <Text style={[styles.tableCell, styles.colQuantity]}>
                {row.quantity}
              </Text>
              <View style={styles.colImei}>
                {row.imeiList.length > 0 ? (
                  row.imeiList.map((imei, i) => (
                    <Text
                      key={i}
                      style={[
                        styles.tableCell,
                        { fontSize: 8 },
                        i < row.imeiList.length - 1 && { marginBottom: 3 },
                      ]}
                    >
                      {imei}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.tableCell}>—</Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colRate]}>
                {formatPrice(row.rate)}
              </Text>
              <Text style={[styles.tableCellBold, styles.colAmount]}>
                {formatPrice(row.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Financial Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            {/* Subtotal */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>
                {formatPrice(order.subtotal)}
              </Text>
            </View>

            {/* Discount */}
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount:</Text>
                <Text style={styles.summaryValue}>
                  -{formatPrice(discount)}
                </Text>
              </View>
            )}

            {/* Shipping */}
            {shipping > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping:</Text>
                <Text style={styles.summaryValue}>{formatPrice(shipping)}</Text>
              </View>
            )}

            {/* Result */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Result:</Text>
              <Text style={styles.summaryValueBold}>{formatPrice(result)}</Text>
            </View>

            {/* Tax */}
            {order.taxAmount && order.taxRate && (
              <View style={styles.summaryRowLast}>
                <Text style={styles.summaryLabel}>
                  Tax ({(order.taxRate * 100).toFixed(2)}%):
                </Text>
                <Text style={styles.summaryValue}>
                  {formatPrice(order.taxAmount)}
                </Text>
              </View>
            )}
          </View>

          {/* Total */}
          <View style={styles.summaryBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{formatPrice(finalTotal)}</Text>
            </View>
          </View>

          {/* Balance Due */}
          <View style={styles.balanceDueBox}>
            <Text style={styles.balanceDueLabel}>Balance Due:</Text>
            <Text style={styles.balanceDueValue}>
              {formatPrice(finalTotal)}
            </Text>
          </View>
        </View>

        {/* Footer: Notes and Terms */}
        <View style={styles.footer}>
          {/* Notes Section */}
          {invoiceData.invoiceNotes &&
            invoiceData.invoiceNotes.trim().length > 0 && (
              <View style={styles.footerSection}>
                <Text style={styles.footerTitle}>Notes:</Text>
                <Text style={styles.footerText}>
                  {invoiceData.invoiceNotes.trim()}
                </Text>
              </View>
            )}

          {/* Terms Section */}
          {invoiceData.invoiceTerms && (
            <View style={styles.footerSection}>
              <Text style={styles.footerTitle}>Terms:</Text>
              <Text style={styles.footerText}>{invoiceData.invoiceTerms}</Text>
            </View>
          )}

          {/* HST Number */}
          {invoiceData.hstNumber && (
            <Text style={styles.hstText}>
              HST #: {invoiceData.hstNumber}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
};
