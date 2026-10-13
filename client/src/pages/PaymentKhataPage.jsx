import styles from "../styles/design.module.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileDown,
  MessageCircle,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { date, inputDate, money } from "../utils/formatters.js";
import {
  AddButton,
  Button,
  DeleteConfirm,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  SearchBox,
  Status,
} from "../components/ui/index.jsx";
import { ErrorNote, errorMessage } from "./shared.jsx";
import {
  balanceType,
  buildPaymentReminder,
  filterAndSortWorkers,
  paymentBalances,
} from "../utils/paymentLedger.js";
import {
  notifyPaymentDataChanged,
  subscribeToPaymentChanges,
} from "../utils/paymentEvents.js";

const paymentColumns = [
  ["Date", "date"],
  ["Entry", "entry"],
  ["Diya (₹)", "outflow"],
  ["Liya (₹)", "inflow"],
  ["Method", "method"],
  ["Reference", "reference"],
  ["Balance (₹)", "balance"],
];

const downloadFile = (contents, name, type) => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function PaymentForm({
  onClose,
  onSaved,
  workerId = "",
  flow = "OUTFLOW",
  initialPayment,
}) {
  const [workers, setWorkers] = useState([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [showWorkerResults, setShowWorkerResults] = useState(false);
  const [form, setForm] = useState(() => ({
    flow: initialPayment?.flow || flow,
    kind: initialPayment?.kind || (flow === "INFLOW" ? "REFUND" : "ADVANCE"),
    amount: initialPayment?.amount || "",
    paidOn: initialPayment ? inputDate(initialPayment.paidOn) : inputDate(),
    worker: initialPayment?.worker?._id || workerId,
    method: initialPayment?.method || "CASH",
    reference: initialPayment?.reference || "",
    notes: initialPayment?.notes || "",
  }));
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request(api.get("/workers", { params: { type: "LABOUR" } }))
      .then(({ workers: result }) => setWorkers(result || []))
      .catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(workerSearch), 200);
    return () => clearTimeout(timer);
  }, [workerSearch]);

  const filteredWorkers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return workers
      .filter((worker) =>
        [worker.name, worker.phone].some((value) =>
          String(value || "")
            .toLocaleLowerCase()
            .includes(query),
        ),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [workers, searchQuery]);
  const selectedWorker = workers.find((worker) => worker._id === form.worker);
  useEffect(() => {
    if (selectedWorker && !workerSearch) setWorkerSearch(selectedWorker.name);
  }, [selectedWorker, workerSearch]);

  const change = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.worker) {
        throw new Error(
          "Please select a labour record from the search results.",
        );
      }
      const payload = { ...form, amount: Number(form.amount) };
      const result = initialPayment
        ? await request(api.patch(`/payments/${initialPayment._id}`, payload))
        : await request(api.post("/payments", payload));
      notifyPaymentDataChanged();
      await onSaved(result.payment);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        initialPayment
          ? "Edit ledger entry"
          : flow === "INFLOW"
            ? "Record amount received"
            : "Record amount given"
      }
      onClose={saving ? () => {} : onClose}
      wide
    >
      <form
        className={`${styles["form-grid"]} ${styles["three-col"]}`}
        onSubmit={save}
      >
        <Field label="Labour">
          <div className={styles["worker-picker"]}>
            <input
              required
              value={workerSearch}
              onFocus={() => setShowWorkerResults(true)}
              onChange={(event) => {
                setWorkerSearch(event.target.value);
                setForm((current) => ({ ...current, worker: "" }));
                setShowWorkerResults(true);
              }}
              placeholder="Search by name or phone"
              role="combobox"
              aria-expanded={showWorkerResults}
              aria-controls="khata-worker-results"
            />
            {selectedWorker && (
              <div className={styles["payment-worker-due"]}>
                <strong>
                  Current due: {money(selectedWorker.totalDue || 0)}
                </strong>
                <small>
                  Given {money(selectedWorker.totalPaid || 0)} · Received{" "}
                  {money(selectedWorker.totalReturned || 0)}
                </small>
              </div>
            )}
            {showWorkerResults && (
              <div
                className={styles["worker-picker-results"]}
                id="khata-worker-results"
              >
                {filteredWorkers.slice(0, 8).map((worker) => (
                  <button
                    type="button"
                    key={worker._id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        worker: worker._id,
                      }));
                      setWorkerSearch(worker.name);
                      setShowWorkerResults(false);
                    }}
                  >
                    <strong>{worker.name}</strong>
                    <small>Due: {money(worker.totalDue || 0)}</small>
                  </button>
                ))}
                {!filteredWorkers.length && <span>No labour found</span>}
              </div>
            )}
          </div>
        </Field>
        <Field label="Entry type">
          {form.flow === "INFLOW" ? (
            <select value={form.kind} onChange={change("kind")}>
              <option value="REFUND">Labour return</option>
              <option value="ADJUSTMENT">Balance adjustment</option>
            </select>
          ) : (
            <select value={form.kind} onChange={change("kind")}>
              <option value="WAGE">Wages</option>
              <option value="ADVANCE">Advance</option>
              <option value="TRAVEL_ADVANCE">Advance for ticket</option>
              <option value="EXPENSE">Kharchi</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="OTHER">Other</option>
            </select>
          )}
        </Field>
        <Field label="Amount">
          <input
            required
            min="0.01"
            step="0.01"
            type="number"
            value={form.amount}
            onChange={change("amount")}
            placeholder="₹ 0"
          />
        </Field>
        <Field label="Date">
          <input
            required
            type="date"
            value={form.paidOn}
            onChange={change("paidOn")}
          />
        </Field>
        <Field label="Payment method">
          <select value={form.method} onChange={change("method")}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Reference">
          <input
            value={form.reference}
            onChange={change("reference")}
            placeholder="Optional transaction/reference number"
          />
        </Field>
        <Field label="Notes">
          <input
            required={form.kind === "OTHER"}
            value={form.notes}
            onChange={change("notes")}
            placeholder={
              form.kind === "OTHER" ? "Specify payment type" : "Optional"
            }
          />
        </Field>
        <div className={styles["modal-actions"]}>
          <ErrorNote error={error} />
          <Button
            type="button"
            className={styles["button-ghost"]}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button className={styles["button-primary"]} loading={saving}>
            {initialPayment
              ? "Save changes"
              : flow === "INFLOW"
                ? "Record received"
                : "Record given"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const relativeDate = (value) => {
  if (!value) return "No payment yet";
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

export function PaymentKhataPage() {
  const navigate = useNavigate();
  const recycleBinRef = useRef(null);
  const [workers, setWorkers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [workerSearch, setWorkerSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [balanceFilter, setBalanceFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("RECENT");
  const [paymentKindFilter, setPaymentKindFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCompany, setShowCompany] = useState(true);
  const [showZone, setShowZone] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState(
    () => `${inputDate().slice(0, 7)}-01`,
  );
  const [reportTo, setReportTo] = useState(inputDate);
  const [reportSearch, setReportSearch] = useState("");
  const [reportSort, setReportSort] = useState("NEWEST");
  const [reportPayments, setReportPayments] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingFlow, setAddingFlow] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(null);
  const [deletedPayments, setDeletedPayments] = useState([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [error, setError] = useState("");
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  const loadWorkers = async () => {
    setError("");
    try {
      const { workers: result } = await request(
        api.get("/workers", { params: { type: "LABOUR" } }),
      );
      setWorkers(result || []);
      setSelectedWorkerId((current) =>
        result?.some((worker) => worker._id === current)
          ? current
          : result?.[0]?._id || "",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingWorkers(false);
    }
  };
  const loadPayments = async () => {
    if (!selectedWorkerId) {
      setPayments([]);
      return;
    }
    try {
      const { payments: result } = await request(
        api.get("/payments", {
          params: {
            worker: selectedWorkerId,
            limit: 500,
          },
        }),
      );
      setPayments(result || []);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  useEffect(() => {
    loadWorkers();
  }, []);
  useEffect(() => {
    loadPayments();
  }, [selectedWorkerId]);
  useEffect(
    () =>
      subscribeToPaymentChanges((source) => {
        if (source !== "remote") return;
        loadWorkers();
        loadPayments();
        if (showRecycleBin) loadDeletedPayments();
        if (reportOpen) loadMasterReport();
      }),
    [showRecycleBin, reportOpen],
  );
  useEffect(() => {
    if (showRecycleBin) {
      recycleBinRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showRecycleBin]);

  const companies = useMemo(
    () =>
      [
        ...new Set(
          workers.map((worker) => worker.companyName?.trim()).filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [workers],
  );
  const teams = useMemo(
    () =>
      [
        ...new Set(
          workers.map((worker) => worker.teamName?.trim()).filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [workers],
  );
  const zones = useMemo(
    () =>
      [
        ...new Set(
          workers.map((worker) => worker.workZone?.trim()).filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [workers],
  );
  const accountWorkers = workers.filter(
    (worker) =>
      (!companyFilter || worker.companyName === companyFilter) &&
      (!teamFilter || worker.teamName === teamFilter) &&
      (!zoneFilter || worker.workZone === zoneFilter) &&
      (statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? worker.active : !worker.active)),
  );
  const dueCount = accountWorkers.filter(
    (worker) => balanceType(worker) === "DENA_HAI",
  ).length;
  const overpaidCount = accountWorkers.filter(
    (worker) => balanceType(worker) === "LENA_HAI",
  ).length;
  const totalDue = accountWorkers.reduce(
    (sum, worker) => sum + Number(worker.totalDue || 0),
    0,
  );
  const totalOverpaid = accountWorkers.reduce(
    (sum, worker) => sum + Number(worker.overpaid || 0),
    0,
  );
  const visibleWorkers = useMemo(() => {
    return filterAndSortWorkers(workers, {
      search: workerSearch,
      company: companyFilter,
      team: teamFilter,
      zone: zoneFilter,
      status: statusFilter,
      balance: balanceFilter,
      sort: sortOrder,
    });
  }, [
    workers,
    workerSearch,
    companyFilter,
    teamFilter,
    zoneFilter,
    statusFilter,
    balanceFilter,
    sortOrder,
  ]);
  const pageCount = Math.max(1, Math.ceil(visibleWorkers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedWorkers = visibleWorkers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const selectedWorker = workers.find(
    (worker) => worker._id === selectedWorkerId,
  );
  const selectedWorkerBalance =
    Number(selectedWorker?.totalDue || 0) -
    Number(selectedWorker?.overpaid || 0);
  const entries = useMemo(
    () => paymentBalances(payments, selectedWorkerBalance),
    [payments, selectedWorkerBalance],
  );
  const visibleEntries = entries.filter((payment) => {
    if (paymentKindFilter && payment.kind !== paymentKindFilter) return false;
    if (paymentMethodFilter && payment.method !== paymentMethodFilter)
      return false;
    const paidOn = new Date(payment.paidOn).toISOString().slice(0, 10);
    if (from && paidOn < from) return false;
    if (to && paidOn > to) return false;
    return true;
  });
  const givenInEntries = visibleEntries
    .filter((payment) => payment.flow !== "INFLOW")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const receivedInEntries = visibleEntries
    .filter((payment) => payment.flow === "INFLOW")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const reportEntries = useMemo(() => {
    const query = reportSearch.trim().toLocaleLowerCase();
    return reportPayments
      .filter((payment) => {
        const paidOn = new Date(payment.paidOn).toISOString().slice(0, 10);
        if (reportFrom && paidOn < reportFrom) return false;
        if (reportTo && paidOn > reportTo) return false;
        if (!query) return true;
        return [
          payment.worker?.name,
          payment.kind?.replaceAll("_", " "),
          payment.notes,
          payment.reference,
          payment.method,
        ].some((value) =>
          String(value || "")
            .toLocaleLowerCase()
            .includes(query),
        );
      })
      .sort((left, right) => {
        const dateDifference =
          new Date(left.createdAt || left.paidOn).getTime() -
          new Date(right.createdAt || right.paidOn).getTime();
        return reportSort === "OLDEST" ? dateDifference : -dateDifference;
      });
  }, [reportPayments, reportFrom, reportTo, reportSearch, reportSort]);
  const reportGiven = reportEntries
    .filter((payment) => payment.flow !== "INFLOW")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const reportReceived = reportEntries
    .filter((payment) => payment.flow === "INFLOW")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const reportNet = reportGiven - reportReceived;
  const loadMasterReport = async () => {
    setReportLoading(true);
    setReportError("");
    try {
      const firstPage = await request(
        api.get("/payments", { params: { limit: 500, skip: 0 } }),
      );
      const allPayments = [...(firstPage.payments || [])];
      for (let start = 500; start < firstPage.total; start += 5000) {
        const pageRequests = [];
        const batchEnd = Math.min(start + 5000, firstPage.total);
        for (let skip = start; skip < batchEnd; skip += 500) {
          pageRequests.push(
            request(api.get("/payments", { params: { limit: 500, skip } })),
          );
        }
        const pages = await Promise.all(pageRequests);
        pages.forEach(({ payments = [] }) => allPayments.push(...payments));
      }
      setReportPayments(allPayments);
      setReportOpen(true);
    } catch (err) {
      setReportError(errorMessage(err));
    } finally {
      setReportLoading(false);
    }
  };

  const loadDeletedPayments = async () => {
    try {
      const { payments: result } = await request(api.get("/payments/deleted"));
      setDeletedPayments(result || []);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const completePaymentSave = async () => {
    setAddingFlow("");
    setEditing(null);
    await Promise.all([loadWorkers(), loadPayments()]);
  };
  const sendReminder = () => {
    if (!selectedWorker?.phone) {
      setError("This labour profile does not have a phone number.");
      return;
    }
    setError("");
    const message = buildPaymentReminder(selectedWorker);
    const digits = selectedWorker.phone.replace(/\D/g, "");
    const internationalPhone = digits.length === 10 ? `91${digits}` : digits;
    const url = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const exportExcel = async () => {
    if (!selectedWorker) return;
    try {
      const { buildWorkforceWorkbook } =
        await import("../utils/workforceExcel.js");
      const records = visibleEntries.map((payment) => ({
        date: date(payment.paidOn),
        entry: payment.kind.replaceAll("_", " "),
        outflow: payment.flow === "INFLOW" ? "" : Number(payment.amount),
        inflow: payment.flow === "INFLOW" ? Number(payment.amount) : "",
        method: payment.method || "",
        reference: payment.reference || payment.notes || "",
        balance: Number(payment.balanceAfter),
      }));
      const netBalance = selectedWorkerBalance;
      const topRows = [
        ["LABOUR PAYMENT KHATA"],
        ["Labour", selectedWorker.name],
        ["Phone", selectedWorker.phone || "—"],
        ["Company", selectedWorker.companyName || "—"],
        ["Team", selectedWorker.teamName || "—"],
        ["Work zone", selectedWorker.workZone || "—"],
        ["Payable", Number(selectedWorker.totalPayable || 0)],
        ["Total given", Number(selectedWorker.totalPaid || 0)],
        ["Received back", Number(selectedWorker.totalReturned || 0)],
        [
          "Net balance",
          `${netBalance > 0 ? "Dena hai" : netBalance < 0 ? "Lena hai" : "Clear"} · ${money(Math.abs(netBalance))}`,
        ],
        [],
      ];
      const workbook = buildWorkforceWorkbook(
        records,
        paymentColumns,
        (row, key) => row[key],
        topRows,
      );
      downloadFile(
        workbook,
        `labour-khata-${selectedWorker.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const downloadKhataPdf = async () => {
    if (!selectedWorker) return;
    setGeneratingPdf(true);
    setError("");
    try {
      const [{ downloadTransactionStatementPdf }, { profile }] =
        await Promise.all([
          import("../utils/transactionStatementPdf.js"),
          request(api.get("/company-profile")),
        ]);
      const paymentDates = visibleEntries
        .map((payment) => new Date(payment.paidOn).toISOString().slice(0, 10))
        .sort();
      const periodFrom = from || paymentDates[0] || inputDate();
      const periodTo =
        to || paymentDates[paymentDates.length - 1] || periodFrom;
      downloadTransactionStatementPdf({
        profile,
        from: periodFrom,
        to: periodTo,
        payments: visibleEntries,
        title: "LABOUR PAYMENT KHATA",
        subtitle: [
          selectedWorker.name,
          selectedWorker.phone,
          selectedWorker.companyName,
          selectedWorker.teamName,
          selectedWorker.workZone,
        ]
          .filter(Boolean)
          .join(" · "),
        includeWorker: false,
        includeBalance: true,
        balanceValue: selectedWorkerBalance,
        balanceLabel: "CURRENT BALANCE",
        fileName: `labour-khata-${selectedWorker.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGeneratingPdf(false);
    }
  };
  const downloadMasterReportPdf = async () => {
    setGeneratingPdf(true);
    setReportError("");
    try {
      const [{ downloadTransactionStatementPdf }, { profile }] =
        await Promise.all([
          import("../utils/transactionStatementPdf.js"),
          request(api.get("/company-profile")),
        ]);
      let runningBalance = 0;
      const balanceById = new Map();
      [...reportEntries]
        .sort(
          (left, right) =>
            new Date(left.paidOn).getTime() -
              new Date(right.paidOn).getTime() ||
            new Date(left.createdAt || 0).getTime() -
              new Date(right.createdAt || 0).getTime(),
        )
        .forEach((payment) => {
          runningBalance +=
            (payment.flow === "INFLOW" ? -1 : 1) *
            Number(payment.amount || 0);
          balanceById.set(payment._id, runningBalance);
        });
      const payments = reportEntries.map((payment) => ({
        ...payment,
        balanceAfter: balanceById.get(payment._id),
      }));
      downloadTransactionStatementPdf({
        profile,
        from: reportFrom || inputDate(),
        to: reportTo || inputDate(),
        payments,
        title: "ALL LABOUR TRANSACTIONS",
        subtitle: `${payments.length} entries`,
        orientation: "landscape",
        includeWorker: true,
        includeBalance: true,
        balanceValue: reportNet,
        balanceLabel: "PERIOD BALANCE",
        fileName: `all-labour-transactions-${reportFrom || "all-dates"}-to-${reportTo || "all-dates"}.pdf`,
      });
    } catch (err) {
      setReportError(errorMessage(err));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleBalanceTab = (value) => {
    setBalanceFilter(value);
    setPage(1);
  };
  const handleSelectWorker = (worker) => {
    setSelectedWorkerId(worker._id);
    setError("");
  };
  const addWorker = () => navigate("/labour/workers");

  return (
    <>
      <PageHeader
        className={styles["payment-page-header"]}
        title="Labour Payment Khata"
        action={
          <Button
            type="button"
            icon={Trash2}
            className={styles["button-secondary"]}
            onClick={() => {
              setShowRecycleBin((current) => !current);
              if (!showRecycleBin) loadDeletedPayments();
            }}
          >
            Recycle bin
          </Button>
        }
      />
      <div
        className={`${styles["payment-khata-layout"]} ${
          selectedWorkerId ? styles["payment-khata-selected"] : ""
        }`}
      >
        <Panel
          title="Labour accounts"
          detail={`${companyFilter || "All companies"} · ${accountWorkers.length} labour profiles`}
          className={styles["payment-khata-list-panel"]}
          action={
            <div className={styles["payment-list-toolbar"]}>
              <SearchBox
                value={workerSearch}
                onChange={(value) => {
                  setWorkerSearch(value);
                  setPage(1);
                }}
                placeholder="Search name or phone"
              />
              <select
                aria-label="Company filter"
                value={companyFilter}
                onChange={(event) => {
                  setCompanyFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All companies</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
              <select
                aria-label="Team filter"
                value={teamFilter}
                onChange={(event) => {
                  setTeamFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All teams</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
              <select
                aria-label="Work zone filter"
                value={zoneFilter}
                onChange={(event) => {
                  setZoneFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All zones</option>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <select
                aria-label="Labour status filter"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active labour</option>
                <option value="INACTIVE">Inactive labour</option>
              </select>
              <select
                aria-label="Sort labour accounts"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              >
                <option value="RECENT">Recent</option>
                <option value="BALANCE_HIGH">Balance high</option>
                <option value="BALANCE_LOW">Balance low</option>
                <option value="NAME">Name A–Z</option>
              </select>
            </div>
          }
        >
          <div className={styles["khata-balance-tabs"]}>
            {[
              ["ALL", "All labour", accountWorkers.length],
              ["DUE", "Dena hai", dueCount],
              ["OVERPAID", "Lena hai", overpaidCount],
            ].map(([value, label, count]) => (
              <button
                type="button"
                key={value}
                className={balanceFilter === value ? styles["active"] : ""}
                onClick={() => handleBalanceTab(value)}
              >
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
          <div className={styles["khata-balance-totals"]}>
            <span className={styles["dena-hai"]}>
              Dena hai <strong>{money(totalDue)}</strong>
            </span>
            <span className={styles["lena-hai"]}>
              Lena hai <strong>{money(totalOverpaid)}</strong>
            </span>
            <Button
              type="button"
              className={styles["button-secondary"]}
              onClick={loadMasterReport}
              disabled={reportLoading}
            >
              {reportLoading ? "Loading report…" : "Report dekhein"}
            </Button>
          </div>
          <div className={styles["khata-worker-list"]}>
            {loadingWorkers ? (
              <Empty title="Loading labour accounts…" />
            ) : pagedWorkers.length ? (
              pagedWorkers.map((worker) => {
                const direction = balanceType(worker);
                const balance =
                  direction === "LENA_HAI"
                    ? Number(worker.overpaid || 0)
                    : Number(worker.totalDue || 0);
                return (
                  <button
                    type="button"
                    key={worker._id}
                    className={`${styles["khata-worker"]} ${selectedWorkerId === worker._id ? styles["selected"] : ""}`}
                    onClick={() => handleSelectWorker(worker)}
                  >
                    <span className={styles["khata-avatar"]}>
                      {worker.name?.trim().charAt(0)?.toUpperCase() || "L"}
                    </span>
                    <span className={styles["khata-worker-info"]}>
                      <strong>{worker.name}</strong>
                      <small>
                        {[
                          showCompany ? worker.companyName : "",
                          showZone ? worker.workZone : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || worker.phone}
                      </small>
                      <small>{relativeDate(worker.lastPaymentOn)}</small>
                    </span>
                    <span
                      className={`${styles["khata-worker-balance"]} ${direction === "LENA_HAI" ? styles["lena-hai"] : direction === "DENA_HAI" ? styles["dena-hai"] : ""}`}
                    >
                      <strong>{money(balance)}</strong>
                      <small>
                        {direction === "LENA_HAI"
                          ? "EXTRA"
                          : direction === "DENA_HAI"
                            ? "DUE"
                            : "CLEAR"}
                      </small>
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty
                title="No matching labour accounts"
                detail="Change the filters or search terms."
              />
            )}
          </div>
          <div className={styles["khata-list-footer"]}>
            <label>
              Show
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
              entries
            </label>
            <span>
              {visibleWorkers.length
                ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, visibleWorkers.length)} of ${visibleWorkers.length}`
                : "0 entries"}
            </span>
            <div>
              <Button
                type="button"
                className={styles["button-ghost"]}
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                ‹
              </Button>
              <Button
                type="button"
                className={styles["button-ghost"]}
                disabled={currentPage >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                ›
              </Button>
            </div>
          </div>
          <div className={styles["khata-worker-actions"]}>
            <AddButton
              type="button"
              className={styles["button-primary"]}
              onClick={addWorker}
            >
              Add labour
            </AddButton>
          </div>
        </Panel>

        <Panel
          className={styles["payment-khata-detail-panel"]}
          title={
            selectedWorker ? selectedWorker.name : "Select a labour account"
          }
          detail={
            selectedWorker
              ? [selectedWorker.companyName, selectedWorker.workZone]
                  .filter(Boolean)
                  .join(" · ") || selectedWorker.phone
              : "Choose a labour profile to view its ledger."
          }
          action={
            selectedWorker && (
              <div className={styles["khata-detail-actions"]}>
                <Button
                  type="button"
                  icon={ArrowLeft}
                  className={`${styles["button-ghost"]} ${styles["khata-mobile-back"]}`}
                  onClick={() => setSelectedWorkerId("")}
                >
                  Labour accounts
                </Button>
                <Button
                  type="button"
                  icon={MessageCircle}
                  className={styles["button-whatsapp"]}
                  onClick={sendReminder}
                  disabled={!selectedWorker.phone}
                >
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  icon={Download}
                  className={styles["button-excel"]}
                  onClick={exportExcel}
                >
                  Excel
                </Button>
                <Button
                  type="button"
                  icon={FileDown}
                  className={styles["button-pdf"]}
                  onClick={downloadKhataPdf}
                  loading={generatingPdf}
                >
                  Download PDF
                </Button>
                <Button
                  type="button"
                  icon={Settings2}
                  className={styles["button-ghost"]}
                  title="Ledger display settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  Settings
                </Button>
              </div>
            )
          }
        >
          {selectedWorker ? (
            <>
              <div className={styles["khata-net-balance"]}>
                <span>Net Balance</span>
                <div
                  className={`${styles["khata-net-amount"]} ${
                    balanceType(selectedWorker) === "DENA_HAI"
                      ? styles["dena-hai"]
                      : balanceType(selectedWorker) === "LENA_HAI"
                        ? styles["lena-hai"]
                        : ""
                  }`}
                >
                  <strong>
                    {money(
                      selectedWorker.totalDue > 0
                        ? selectedWorker.totalDue
                        : selectedWorker.overpaid || 0,
                    )}
                  </strong>
                  <small>
                    {balanceType(selectedWorker) === "DENA_HAI"
                      ? "Due hai"
                      : balanceType(selectedWorker) === "LENA_HAI"
                        ? "Extra hai"
                        : "Clear"}
                  </small>
                </div>
              </div>
              <div className={styles["khata-entry-filters"]}>
                <Field label="Entry type">
                  <select
                    value={paymentKindFilter}
                    onChange={(event) =>
                      setPaymentKindFilter(event.target.value)
                    }
                  >
                    <option value="">All entries</option>
                    <option value="WAGE">Wages</option>
                    <option value="ADVANCE">Advance</option>
                    <option value="TRAVEL_ADVANCE">Ticket advance</option>
                    <option value="EXPENSE">Kharchi</option>
                    <option value="REFUND">Labour return</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Method">
                  <select
                    value={paymentMethodFilter}
                    onChange={(event) =>
                      setPaymentMethodFilter(event.target.value)
                    }
                  >
                    <option value="">All methods</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="From">
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </Field>
              </div>
              <ErrorNote error={error} />
              <div className={styles["table-wrap"]}>
                <table className={styles["khata-entry-table"]}>
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th>Diya (₹)</th>
                      <th>Liya (₹)</th>
                      <th>Balance (₹)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((payment) => (
                      <tr key={payment._id}>
                        <td>
                          <strong>
                            {date(payment.paidOn)} · {payment.method}
                          </strong>
                          <Status
                            tone={payment.flow === "INFLOW" ? "green" : "blue"}
                          >
                            {payment.flow === "INFLOW"
                              ? "Liya · You got"
                              : payment.kind.replaceAll("_", " ")}
                          </Status>
                          {(payment.notes || payment.reference) && (
                            <small>{payment.notes || payment.reference}</small>
                          )}
                        </td>
                        <td className={styles["payment-given"]}>
                          {payment.flow === "INFLOW"
                            ? "—"
                            : money(payment.amount)}
                        </td>
                        <td className={styles["payment-received"]}>
                          {payment.flow === "INFLOW"
                            ? money(payment.amount)
                            : "—"}
                        </td>
                        <td
                          className={
                            payment.balanceAfter > 0
                              ? styles["payment-due-balance"]
                              : payment.balanceAfter < 0
                                ? styles["payment-extra-balance"]
                                : styles["payment-clear-balance"]
                          }
                        >
                          <span>{money(Math.abs(payment.balanceAfter))}</span>
                          <small>
                            {payment.balanceAfter > 0
                              ? "Due hai"
                              : payment.balanceAfter < 0
                                ? "Extra hai"
                                : "Clear"}
                          </small>
                        </td>
                        <td>
                          <div className={styles["actions"]}>
                            <button
                              type="button"
                              className={styles["icon-button"]}
                              title="Edit entry"
                              onClick={() => setEditing(payment)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                              title="Move entry to recycle bin"
                              onClick={() => {
                                setError("");
                                setDeleting(payment);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!entries.length && (
                      <tr>
                        <td colSpan="5">
                          <Empty
                            title="No entries for this labour"
                            detail="Record the first amount given or received."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className={styles["khata-ledger-footer"]}>
                <span>
                  Given in period: <strong>{money(givenInEntries)}</strong>
                </span>
                <span>
                  Received in period:{" "}
                  <strong>{money(receivedInEntries)}</strong>
                </span>
              </div>
              <div className={styles["khata-quick-actions"]}>
                <Button
                  type="button"
                  icon={ArrowDownLeft}
                  className={styles["button-given"]}
                  onClick={() => setAddingFlow("OUTFLOW")}
                >
                  Diya / You Gave
                </Button>
                <Button
                  type="button"
                  icon={ArrowUpRight}
                  className={styles["button-received"]}
                  onClick={() => setAddingFlow("INFLOW")}
                >
                  Liya / You Got
                </Button>
              </div>
            </>
          ) : (
            <>
              <ErrorNote error={error} />
              <Empty
                title={
                  loadingWorkers
                    ? "Loading labour accounts…"
                    : "No labour accounts yet"
                }
                detail="Add a labour profile to start recording payments."
              />
              {!loadingWorkers && (
                <AddButton
                  type="button"
                  className={styles["button-primary"]}
                  onClick={addWorker}
                >
                  Add labour
                </AddButton>
              )}
            </>
          )}
        </Panel>
      </div>

      {showRecycleBin && (
        <div ref={recycleBinRef} className={styles["payment-recycle-anchor"]}>
          <Panel
            title="Payment recycle bin"
            detail="Restore deleted entries or permanently remove them."
            className={styles["payment-recycle-panel"]}
          >
            <div className={styles["table-wrap"]}>
              <table>
                <thead>
                  <tr>
                    <th>Labour</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Deleted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {deletedPayments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{payment.worker?.name || "Labour"}</td>
                      <td>{payment.kind}</td>
                      <td>{money(payment.amount)}</td>
                      <td>{date(payment.deletedAt)}</td>
                      <td>
                        <div className={styles["payment-recycle-actions"]}>
                          <Button
                            type="button"
                            className={styles["button-secondary"]}
                            onClick={async () => {
                              try {
                                await request(
                                  api.patch(`/payments/${payment._id}/restore`),
                                );
                                notifyPaymentDataChanged();
                                await Promise.all([
                                  loadDeletedPayments(),
                                  loadWorkers(),
                                  loadPayments(),
                                ]);
                              } catch (err) {
                                setError(errorMessage(err));
                              }
                            }}
                          >
                            Restore
                          </Button>
                          <Button
                            type="button"
                            className={styles["button-danger"]}
                            icon={Trash2}
                            aria-label={`Permanently delete payment of ${money(payment.amount)} for ${payment.worker?.name || "Labour"}`}
                            onClick={() => setPermanentlyDeleting(payment)}
                          >
                            Delete permanently
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!deletedPayments.length && (
                    <tr>
                      <td colSpan="5">
                        <Empty title="Recycle bin empty" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {reportOpen && (
        <Modal
          wide
          className={styles["khata-report-modal"]}
          title="All transactions"
          action={
            <Button
              type="button"
              icon={FileDown}
              className={styles["button-secondary"]}
              onClick={downloadMasterReportPdf}
              loading={generatingPdf}
            >
              Download PDF
            </Button>
          }
          onClose={() => setReportOpen(false)}
        >
          <ErrorNote error={reportError} />
          <div className={styles["khata-report-filters"]}>
            <Field label="From date">
              <input
                type="date"
                value={reportFrom}
                max={reportTo || undefined}
                onChange={(event) => setReportFrom(event.target.value)}
              />
            </Field>
            <Field label="To date">
              <input
                type="date"
                value={reportTo}
                min={reportFrom || undefined}
                onChange={(event) => setReportTo(event.target.value)}
              />
            </Field>
            <div className={styles["khata-report-search"]}>
              <span>Search entries</span>
              <SearchBox
                value={reportSearch}
                onChange={setReportSearch}
                placeholder="Search type, note, reference…"
              />
            </div>
            <Field label="Sort entries">
              <select
                value={reportSort}
                onChange={(event) => setReportSort(event.target.value)}
              >
                <option value="NEWEST">Newest first</option>
                <option value="OLDEST">Oldest first</option>
              </select>
            </Field>
          </div>
          <div className={styles["khata-report-balance"]}>
            <span>Net transaction balance</span>
            <strong
              className={
                reportNet > 0
                  ? styles["dena-hai"]
                  : reportNet < 0
                    ? styles["lena-hai"]
                    : ""
              }
            >
              {money(Math.abs(reportNet))}
              {reportNet > 0
                ? " · Diya zyada"
                : reportNet < 0
                  ? " · Liya zyada"
                  : " · Clear"}
            </strong>
          </div>
          <div className={styles["khata-report-summary"]}>
            <div className={styles["khata-report-count"]}>
              <span>Entries</span>
              <strong>{reportEntries.length}</strong>
            </div>
            <div className={styles["khata-report-total"]}>
              <span>Diya (₹)</span>
              <strong>{money(reportGiven)}</strong>
            </div>
            <div className={styles["khata-report-total"]}>
              <span>Liya (₹)</span>
              <strong>{money(reportReceived)}</strong>
            </div>
          </div>
          <div className={styles["khata-report-list"]}>
            {reportEntries.map((payment) => (
              <article
                className={styles["khata-report-entry"]}
                key={payment._id}
              >
                <div className={styles["khata-report-entry-info"]}>
                  <strong>
                    {payment.worker?.name || "Company expense"} ·{" "}
                    {payment.kind.replaceAll("_", " ")}
                  </strong>
                  <span>{date(payment.paidOn)} · {payment.method}</span>
                  {(payment.notes || payment.reference) && (
                    <small>
                      {[payment.notes, payment.reference]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                </div>
                <div className={styles["khata-report-amounts"]}>
                  <div>
                    <span>Diya</span>
                    <strong className={styles["payment-given"]}>
                      {payment.flow === "INFLOW" ? "—" : money(payment.amount)}
                    </strong>
                  </div>
                  <div>
                    <span>Liya</span>
                    <strong className={styles["payment-received"]}>
                      {payment.flow === "INFLOW" ? money(payment.amount) : "—"}
                    </strong>
                  </div>
                </div>
              </article>
            ))}
            {!reportEntries.length && (
              <Empty title="No entries for these dates or search" />
            )}
          </div>
        </Modal>
      )}

      {addingFlow && (
        <PaymentForm
          workerId={selectedWorkerId}
          flow={addingFlow}
          onClose={() => setAddingFlow("")}
          onSaved={completePaymentSave}
        />
      )}
      {editing && (
        <PaymentForm
          initialPayment={editing}
          workerId={selectedWorkerId}
          onClose={() => setEditing(null)}
          onSaved={completePaymentSave}
        />
      )}
      {deleting && (
        <Modal
          title="Move ledger entry to recycle bin?"
          onClose={deletingBusy ? () => {} : () => setDeleting(null)}
        >
          <p>
            {money(deleting.amount)} recorded on {date(deleting.paidOn)} will be
            removed from this balance. You can restore it from the recycle bin.
          </p>
          <ErrorNote error={error} />
          <div className={styles["modal-actions"]}>
            <Button
              type="button"
              className={styles["button-ghost"]}
              onClick={() => setDeleting(null)}
              disabled={deletingBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={styles["button-danger"]}
              onClick={async () => {
                setDeletingBusy(true);
                try {
                  await request(api.delete(`/payments/${deleting._id}`));
                  notifyPaymentDataChanged();
                  setDeleting(null);
                  await Promise.all([loadWorkers(), loadPayments()]);
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setDeletingBusy(false);
                }
              }}
              loading={deletingBusy}
            >
              Move to recycle bin
            </Button>
          </div>
        </Modal>
      )}
      {permanentlyDeleting && (
        <DeleteConfirm
          itemLabel={`${money(permanentlyDeleting.amount)} payment for ${permanentlyDeleting.worker?.name || "Labour"}`}
          onClose={() => setPermanentlyDeleting(null)}
          onConfirm={async () => {
            await request(
              api.delete(`/payments/${permanentlyDeleting._id}/permanent`),
            );
            notifyPaymentDataChanged();
            setDeletedPayments((current) =>
              current.filter((payment) => payment._id !== permanentlyDeleting._id),
            );
            setPermanentlyDeleting(null);
          }}
        />
      )}
      {settingsOpen && (
        <Modal
          title="Khata display settings"
          onClose={() => setSettingsOpen(false)}
        >
          <div className={styles["khata-settings"]}>
            <Field label="Labour rows per page">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10 rows</option>
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
              </select>
            </Field>
            <label>
              <input
                type="checkbox"
                checked={showCompany}
                onChange={(event) => setShowCompany(event.target.checked)}
              />
              Show company in labour list
            </label>
            <label>
              <input
                type="checkbox"
                checked={showZone}
                onChange={(event) => setShowZone(event.target.checked)}
              />
              Show work zone in labour list
            </label>
            <Button
              type="button"
              className={styles["button-primary"]}
              onClick={() => setSettingsOpen(false)}
            >
              Done
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
