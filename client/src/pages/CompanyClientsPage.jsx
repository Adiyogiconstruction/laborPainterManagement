import { Fragment, useEffect, useState } from "react";
import {
  Building2,
  ClipboardList,
  BarChart3,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  FileDown,
  Search,
  ChevronDown,
} from "lucide-react";
import styles from "../styles/design.module.css";
import api, { request } from "../services/apiClient.js";
import {
  AddButton,
  Button,
  DeleteConfirm,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
} from "../components/ui/index.jsx";
import { ErrorNote, errorMessage } from "./shared.jsx";
import { date, money } from "../utils/formatters.js";

const localDateInput = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const blankZoneRate = () => ({
  zone: "",
  companyDailyRate: "",
  overtimeHourlyRate: "0",
  labourDailyRate: "",
  labourOvertimeRate: "0",
});

const blankForm = () => ({
  name: "",
  zones: [blankZoneRate()],
  applicableFrom: localDateInput(new Date()),
});

const getPeriodRange = (period, customRange) => {
  const now = new Date();
  if (period === "CUSTOM") return customRange;
  if (period === "ALL") {
    return { from: "1970-01-01", to: localDateInput(now) };
  }
  if (period === "DAY") {
    const today = localDateInput(now);
    return { from: today, to: today };
  }
  if (period === "WEEK") {
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: localDateInput(start), to: localDateInput(end) };
  }
  if (period === "YEAR") {
    return {
      from: localDateInput(new Date(now.getFullYear(), 0, 1)),
      to: localDateInput(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return {
    from: localDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const periodLabel = (period) =>
  ({
    DAY: "Today",
    WEEK: "This week",
    MONTH: "This month",
    YEAR: "This year",
    ALL: "All time",
    CUSTOM: "Custom range",
  })[period] || "This month";

const rangeLabel = (range) =>
  `${date(`${range.from}T00:00:00`)} – ${date(`${range.to}T00:00:00`)}`;
const rateLabel = (values = []) =>
  values.length
    ? [...new Set(values.map(Number).filter(Number.isFinite))]
        .sort((left, right) => left - right)
        .map(money)
        .join(" · ") || "—"
    : "—";
const workerIdsFilter = (selection) =>
  selection === null ? "" : selection.length ? selection.join(",") : "__none__";

const blankAssignment = () => {
  const today = localDateInput(new Date());
  return { labourCount: "", zone: "", startDate: today, endDate: "", ongoing: true };
};

const currentMonthRange = () => {
  const now = new Date();
  return {
    from: localDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

function LabourRateEditor({ worker, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState({
    ...worker.rates,
    applicableFrom: localDateInput(new Date()),
  });
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Rates · current values apply to new attendance</summary>
      <form
        className={styles["company-worker-rate-form"]}
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await onSave(worker.id, {
              labourDailyRate: rates.labourDailyRate,
              labourOvertimeRate: rates.labourOvertimeRate,
              applicableFrom: rates.applicableFrom,
            })
          ) {
            setOpen(false);
          }
        }}
      >
        {[
          ["labourDailyRate", "Labour ₹/day"],
          ["labourOvertimeRate", "Labour OT ₹/hr"],
        ].map(([field, label]) => (
          <Field label={label} key={field}>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={rates[field]}
              onChange={(event) =>
                setRates((current) => ({
                  ...current,
                  [field]: event.target.value,
                }))
              }
            />
          </Field>
        ))}
        <Field label="Applicable from">
          <input
            type="date"
            required
            value={rates.applicableFrom}
            onChange={(event) =>
              setRates((current) => ({
                ...current,
                applicableFrom: event.target.value,
              }))
            }
          />
        </Field>
        <Button
          type="submit"
          className={styles["button-primary"]}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save rates"}
        </Button>
      </form>
    </details>
  );
}

export function CompanyClientsPage({ canEdit = false, isOwner = false }) {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [detailRange, setDetailRange] = useState(currentMonthRange);
  const [appliedDetailRange, setAppliedDetailRange] = useState(currentMonthRange);
  const [detailZone, setDetailZone] = useState("");
  const [appliedDetailZone, setAppliedDetailZone] = useState("");
  const [detailTeam, setDetailTeam] = useState("");
  const [appliedDetailTeam, setAppliedDetailTeam] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState(null);
  const [appliedSelectedWorkers, setAppliedSelectedWorkers] = useState(null);
  const [labourSearch, setLabourSearch] = useState("");
  const [labourMenuOpen, setLabourMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(10);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [companyOverview, setCompanyOverview] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [savingRateFor, setSavingRateFor] = useState("");
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [trackingCompany, setTrackingCompany] = useState(null);
  const [assignmentFormOpen, setAssignmentFormOpen] = useState(false);
  const [assignmentPeriod, setAssignmentPeriod] = useState("MONTH");
  const [assignmentForm, setAssignmentForm] = useState(blankAssignment);
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [deletingAssignment, setDeletingAssignment] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentSummary, setAssignmentSummary] = useState({
    labourDays: 0,
    profit: 0,
  });
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [profitPeriod, setProfitPeriod] = useState("MONTH");
  const initialProfitRange = getPeriodRange("MONTH");
  const [customProfitRange, setCustomProfitRange] = useState(initialProfitRange);
  const [profitCompanyFilter, setProfitCompanyFilter] = useState("");
  const [profitStatusFilter, setProfitStatusFilter] = useState("ALL");
  const [profitSummary, setProfitSummary] = useState({
    companies: [],
    totalProfit: 0,
  });
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitError, setProfitError] = useState("");
  const [profitRefresh, setProfitRefresh] = useState(0);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [companyListExpanded, setCompanyListExpanded] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const profitRange = getPeriodRange(profitPeriod, customProfitRange);
  const visibleProfitCompanies = profitSummary.companies.filter((company) => {
    if (profitCompanyFilter && company.companyId !== profitCompanyFilter) {
      return false;
    }
    if (profitStatusFilter === "PROFIT" && company.profit <= 0) return false;
    if (profitStatusFilter === "LOSS" && company.profit >= 0) return false;
    if (profitStatusFilter === "BREAK_EVEN" && company.profit !== 0) return false;
    return true;
  });
  const visibleTotalProfit = visibleProfitCompanies.reduce(
    (total, company) => total + Number(company.profit || 0),
    0,
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request(
        api.get("/companies", {
          params: includeInactive ? { includeInactive: true } : {},
        }),
      );
      setCompanies(result.companies);
      setSelectedCompanyId((current) =>
        result.companies.some((company) => company._id === current)
          ? current
          : result.companies[0]?._id || "",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [includeInactive]);

  useEffect(() => {
    if (!isOwner || !selectedCompanyId || !appliedDetailRange.from || !appliedDetailRange.to) {
      setCompanyOverview(null);
      setDetailLoading(false);
      return undefined;
    }
    let current = true;
    setDetailLoading(true);
    setDetailError("");
    request(
      api.get(`/companies/${selectedCompanyId}/overview`, {
        params: {
          from: appliedDetailRange.from,
          to: appliedDetailRange.to,
          zone: appliedDetailZone,
          team: appliedDetailTeam,
          workerIds: workerIdsFilter(appliedSelectedWorkers),
          page: detailPage,
          pageSize: detailPageSize,
        },
      }),
    )
      .then((result) => {
        if (current) setCompanyOverview(result);
      })
      .catch((err) => {
        if (current) setDetailError(errorMessage(err));
      })
      .finally(() => {
        if (current) setDetailLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    isOwner,
    selectedCompanyId,
    appliedDetailRange.from,
    appliedDetailRange.to,
    appliedDetailZone,
    appliedDetailTeam,
    appliedSelectedWorkers,
    detailPage,
    detailPageSize,
    detailRefresh,
  ]);
  const overviewMatchesCompany = Boolean(
    companyOverview &&
      selectedCompanyId &&
      String(companyOverview.company?.id || "") === String(selectedCompanyId),
  );

  useEffect(() => {
    if (!isOwner) return undefined;
    let current = true;
    const range = getPeriodRange(profitPeriod, customProfitRange);
    setProfitLoading(true);
    setProfitError("");
    request(
      api.get("/companies/profit-summary", {
        params: {
          ...range,
          ...(includeInactive ? { includeInactive: true } : {}),
        },
      }),
    )
      .then((result) => {
        if (current) setProfitSummary(result);
      })
      .catch((err) => {
        if (current) setProfitError(errorMessage(err));
      })
      .finally(() => {
        if (current) setProfitLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    isOwner,
    profitPeriod,
    customProfitRange.from,
    customProfitRange.to,
    includeInactive,
    profitRefresh,
  ]);

  const applyReportFilters = () => {
    if (!detailRange.from || !detailRange.to || detailRange.from > detailRange.to) {
      setDetailError("Choose a valid report date range.");
      return;
    }
    setDetailError("");
    setAppliedDetailRange({ ...detailRange });
    setAppliedDetailZone(detailZone);
    setAppliedDetailTeam(detailTeam);
    setAppliedSelectedWorkers(selectedWorkers === null ? null : [...selectedWorkers]);
    setDetailPage(1);
    setLabourMenuOpen(false);
  };

  const resetReportFilters = () => {
    const range = currentMonthRange();
    setDetailRange(range);
    setAppliedDetailRange(range);
    setDetailZone("");
    setAppliedDetailZone("");
    setDetailTeam("");
    setAppliedDetailTeam("");
    setSelectedWorkers(null);
    setAppliedSelectedWorkers(null);
    setLabourSearch("");
    setDetailPage(1);
    setDetailError("");
  };

  const loadAllReportWorkers = async () => {
    if (!companyOverview || !selectedCompanyId) return [];
    setExporting(true);
    setDetailError("");
    try {
      const params = {
        from: appliedDetailRange.from,
        to: appliedDetailRange.to,
        zone: appliedDetailZone,
        team: appliedDetailTeam,
        workerIds: workerIdsFilter(appliedSelectedWorkers),
        page: 1,
        pageSize: 50,
      };
      const firstPage = await request(
        api.get(`/companies/${selectedCompanyId}/overview`, { params }),
      );
      const rows = [...firstPage.workers];
      for (let page = 2; page <= firstPage.pagination.pages; page += 1) {
        const result = await request(
          api.get(`/companies/${selectedCompanyId}/overview`, {
            params: { ...params, page },
          }),
        );
        rows.push(...result.workers);
      }
      return rows;
    } catch (err) {
      setDetailError(errorMessage(err));
      throw err;
    } finally {
      setExporting(false);
    }
  };

  const exportReportPdf = async () => {
    try {
      const rows = await loadAllReportWorkers();
      const { downloadCompanyProfitPdf } = await import("../utils/companyProfitPdf.js");
      downloadCompanyProfitPdf({
        company: companyOverview.company,
        filters: {
          ...appliedDetailRange,
          zone: appliedDetailZone || "All zones",
          team: appliedDetailTeam || "All teams",
          labours:
            appliedSelectedWorkers === null
              ? "All labour"
              : `${appliedSelectedWorkers.length} selected`,
        },
        rows,
        totals: companyOverview.totals,
      });
    } catch (err) {
      setDetailError(errorMessage(err));
    }
  };

  const exportReportExcel = async () => {
    try {
      const rows = await loadAllReportWorkers();
      const { buildWorkforceWorkbook } = await import("../utils/workforceExcel.js");
      const columns = [
        ["Labour", "name"],
        ["Team", "team"],
        ["Zone", "zone"],
        ["Marked days", "attendanceEntries"],
        ["Days", "days"],
        ["OT hours", "overtimeHours"],
        ["Company billing", "companyBilling"],
        ["Labour salary", "labourSalary"],
        ["Duty profit", "dutyProfit"],
        ["OT profit", "overtimeProfit"],
        ["Total profit", "profit"],
      ];
      const workbook = buildWorkforceWorkbook(
        rows,
        columns,
        (row, key) =>
          key === "profit"
            ? Number(row.companyBilling || 0) - Number(row.labourSalary || 0)
            : row[key] ?? "",
        [
          ["Company", companyOverview.company.name],
          ["Date range", `${appliedDetailRange.from} to ${appliedDetailRange.to}`],
          ["Zone", appliedDetailZone || "All zones"],
          ["Team", appliedDetailTeam || "All teams"],
          ["Company billing", companyOverview.totals.companyBilling],
          ["Labour salary", companyOverview.totals.labourSalary],
          ["Duty profit", companyOverview.totals.dutyProfit],
          ["Overtime profit", companyOverview.totals.overtimeProfit],
          ["Total profit", companyOverview.totals.margin],
        ],
      );
      const url = URL.createObjectURL(
        new Blob([workbook], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `labour-profit-${appliedDetailRange.from}-to-${appliedDetailRange.to}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err) setDetailError(errorMessage(err));
    }
  };

  const availableLabours = (companyOverview?.labourOptions || []).filter(
    (labour) =>
      (!detailTeam || labour.team === detailTeam) &&
      (!detailZone ||
        (detailZone === "Unassigned"
          ? labour.zone === "Unassigned"
          : labour.zone.toLocaleLowerCase() === detailZone.toLocaleLowerCase())),
  );

  const trackingCompanyId = trackingCompany?._id;
  useEffect(() => {
    if (!trackingCompanyId) return undefined;
    let current = true;
    const range = getPeriodRange(assignmentPeriod);
    setAssignmentLoading(true);
    setAssignmentError("");
    request(
      api.get(`/companies/${trackingCompanyId}/assignments`, {
        params: range,
      }),
    )
      .then((result) => {
        if (!current) return;
        setAssignments(result.assignments);
        setAssignmentSummary(result.summary);
      })
      .catch((err) => {
        if (current) setAssignmentError(errorMessage(err));
      })
      .finally(() => {
        if (current) setAssignmentLoading(false);
      });
    return () => {
      current = false;
    };
  }, [trackingCompanyId, assignmentPeriod]);

  const refreshAssignments = async () => {
    const range = getPeriodRange(assignmentPeriod);
    const result = await request(
      api.get(`/companies/${trackingCompany._id}/assignments`, {
        params: range,
      }),
    );
    setAssignments(result.assignments);
    setAssignmentSummary(result.summary);
    setProfitRefresh((value) => value + 1);
  };

  const resetForm = () => {
    setEditingId("");
    setForm(blankForm());
    setFormOpen(false);
  };

  const addCompany = () => {
    setEditingId("");
    setForm(blankForm());
    setFormOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const zoneRows = form.zones.filter((row) => row.zone.trim());
      if (!zoneRows.length) {
        throw new Error("Add at least one company zone.");
      }
      if (
        zoneRows.some(
          (row) =>
            !String(row.companyDailyRate).trim() ||
            !Number.isFinite(Number(row.companyDailyRate)) ||
            Number(row.companyDailyRate) < 0 ||
            !String(row.labourDailyRate).trim() ||
            !Number.isFinite(Number(row.labourDailyRate)) ||
            Number(row.labourDailyRate) < 0,
        ) &&
        isOwner
      ) {
        throw new Error("Enter both rates for every company zone.");
      }
      const zoneKeys = zoneRows.map((row) => row.zone.trim().toLocaleLowerCase());
      if (new Set(zoneKeys).size !== zoneKeys.length) {
        throw new Error("Each zone can only be added once.");
      }
      const companyData = {
        name: form.name,
        zones: zoneRows.map((row) => row.zone.trim()),
        ...(isOwner
          ? {
              zoneRates: zoneRows,
              applicableFrom: form.applicableFrom,
            }
          : {}),
      };
      if (editingId) {
        await request(api.patch(`/companies/${editingId}`, companyData));
      } else {
        await request(api.post("/companies", companyData));
      }
      resetForm();
      await load();
      setProfitRefresh((value) => value + 1);
      setDetailRefresh((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const edit = (company) => {
    setEditingId(company._id);
    setForm({
      name: company.name,
      zones: (company.zones || []).length
        ? company.zones.map((zone) => {
            const currentRate = (company.zoneRates || []).find(
              (rate) => rate.zone.toLocaleLowerCase() === zone.toLocaleLowerCase(),
            );
            return {
              zone,
              companyDailyRate: currentRate?.configured
                ? String(currentRate.dailyRate)
                : "",
              overtimeHourlyRate: currentRate?.configured
                ? String(currentRate.overtimeHourlyRate ?? 0)
                : "0",
              labourDailyRate: currentRate?.configured
                ? String(currentRate.labourDailyRate)
                : "",
              labourOvertimeRate: currentRate?.configured
                ? String(currentRate.labourOvertimeRate ?? 0)
                : "0",
            };
          })
        : [blankZoneRate()],
      applicableFrom: localDateInput(new Date()),
    });
    setFormOpen(true);
  };

  const saveAssignment = async (event) => {
    event.preventDefault();
    setAssignmentSaving(true);
    setAssignmentError("");
    try {
      await request(
        editingAssignmentId
          ? api.patch(
              `/companies/${trackingCompany._id}/assignments/${editingAssignmentId}`,
              assignmentForm,
            )
          : api.post(
              `/companies/${trackingCompany._id}/assignments`,
              assignmentForm,
            ),
      );
      setAssignmentForm(blankAssignment());
      setEditingAssignmentId("");
      setAssignmentFormOpen(false);
      await refreshAssignments();
    } catch (err) {
      setAssignmentError(errorMessage(err));
    } finally {
      setAssignmentSaving(false);
    }
  };

  const saveWorkerRates = async (workerId, rates) => {
    setSavingRateFor(workerId);
    setDetailError("");
    try {
      await request(
        api.patch(
          `/companies/${selectedCompanyId}/workers/${workerId}/rates`,
          rates,
        ),
      );
      const result = await request(
        api.get(`/companies/${selectedCompanyId}/overview`, {
          params: {
            from: appliedDetailRange.from,
            to: appliedDetailRange.to,
            zone: appliedDetailZone,
            team: appliedDetailTeam,
            workerIds: workerIdsFilter(appliedSelectedWorkers),
            page: detailPage,
            pageSize: detailPageSize,
          },
        }),
      );
      setCompanyOverview(result);
      setProfitRefresh((value) => value + 1);
      return true;
    } catch (err) {
      setDetailError(errorMessage(err));
      return false;
    } finally {
      setSavingRateFor("");
    }
  };

  const editAssignment = (assignment) => {
    setAssignmentError("");
    setEditingAssignmentId(assignment._id);
    setAssignmentForm({
      labourCount: String(assignment.labourCount),
      zone: assignment.zone || "",
      startDate: new Date(assignment.startDate).toISOString().slice(0, 10),
      endDate: assignment.endDate
        ? new Date(assignment.endDate).toISOString().slice(0, 10)
        : "",
      ongoing: !assignment.endDate,
    });
    setAssignmentFormOpen(true);
  };

  const deleteAssignment = async () => {
    await request(
      api.delete(
        `/companies/${trackingCompany._id}/assignments/${deletingAssignment._id}`,
      ),
    );
    setDeletingAssignment(null);
    try {
      await refreshAssignments();
    } catch (err) {
      setAssignmentError(errorMessage(err));
    }
  };

  const setActive = async (company, active) => {
    setError("");
    try {
      if (active) {
        await request(api.patch(`/companies/${company._id}`, { active: true }));
      } else {
        await request(api.delete(`/companies/${company._id}`));
      }
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const permanentlyDeleteCompany = async () => {
    await request(
      api.delete(`/companies/${deletingCompany._id}/permanent`),
    );
    setDeletingCompany(null);
    await load();
    setProfitRefresh((value) => value + 1);
  };

  const companyListPanel = (
    <Panel
      title="Company & client list"
      detail="Select a saved company when adding or editing a worker."
      className={`${styles["company-client-list-panel"]} ${companyListExpanded ? "" : styles["company-client-list-collapsed"]}`}
      action={
        <div className={styles["company-client-list-actions"]}>
          {canEdit && <AddButton onClick={addCompany}>Add client</AddButton>}
          <label className={styles["company-client-inactive-toggle"]}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Show inactive
          </label>
          <Button
            type="button"
            className={styles["company-client-collapse"]}
            aria-label={companyListExpanded ? "Hide company list" : "Show company list"}
            aria-expanded={companyListExpanded}
            onClick={() => setCompanyListExpanded((expanded) => !expanded)}
          >
            {companyListExpanded ? "Hide company" : "Show company"}
          </Button>
        </div>
      }
    >
      <div className={styles["company-client-list-content"]}>
        {loading ? (
          <Empty title="Loading companies…" />
        ) : companies.length ? (
          <div className={styles["company-client-list"]}>
            {companies.map((company) => (
              <article className={styles["company-client-row"]} key={company._id}>
                <span className={styles["company-client-icon"]}>
                  <Building2 size={18} />
                </span>
                <div className={styles["company-client-info"]}>
                  <strong>{company.name}</strong>
                  <small>
                    Zones: {(company.zones || []).join(" · ") || "Not configured"}
                  </small>
                  {!company.active && (
                    <span className={styles["company-client-status"]}>Inactive</span>
                  )}
                </div>
                <div className={styles["actions-inline"]}>
                  <Button
                    type="button"
                    icon={ClipboardList}
                    className={`${styles["button-primary"]} ${styles["company-track-button"]}`}
                    onClick={() => {
                      setTrackingCompany(company);
                      setAssignmentFormOpen(false);
                      setAssignmentForm(blankAssignment());
                      setAssignmentPeriod("MONTH");
                    }}
                    aria-label={`Track labour for ${company.name}`}
                  >
                    Track labour
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        className={styles["button-secondary"]}
                        onClick={() => edit(company)}
                        aria-label={`Edit ${company.name}`}
                      >
                        <Pencil size={15} />
                      </Button>
                      {company.active ? (
                        <Button
                          type="button"
                          className={styles["button-danger"]}
                          onClick={() => setActive(company, false)}
                          aria-label={`Deactivate ${company.name}`}
                        >
                          <Trash2 size={15} />
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            className={styles["button-secondary"]}
                            onClick={() => setActive(company, true)}
                            aria-label={`Restore ${company.name}`}
                          >
                            <RotateCcw size={15} />
                          </Button>
                          {isOwner && (
                            <Button
                              type="button"
                              className={styles["button-danger"]}
                              onClick={() => setDeletingCompany(company)}
                              aria-label={`Permanently delete ${company.name}`}
                              title="Permanently delete company and history"
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="No companies or clients yet"
            detail={
              canEdit
                ? "Add a company/client above to use it in worker profiles."
                : "An admin can add companies and clients."
            }
          />
        )}
      </div>
    </Panel>
  );

  return (
    <>
      <PageHeader
        title="Companies & Clients"
      />
      <ErrorNote error={error} />
      {companyListPanel}
      {isOwner && (
        <Panel
          title="Manual labour assignment summary"
          detail={`${periodLabel(profitPeriod)} · ${rangeLabel(profitRange)} · Contract/headcount margin from Track labour assignments; attendance is not used, so it can include assigned labour-days even when attendance is absent or not entered.`}
          className={styles["company-profit-panel"]}
        >
          {profitError ? (
            <ErrorNote error={profitError} />
          ) : (
            <>
              {profitPeriod === "CUSTOM" && (
                <div className={styles["company-profit-custom-range"]}>
                  <Field label="From">
                    <input
                      type="date"
                      value={customProfitRange.from}
                      max={customProfitRange.to}
                      onChange={(event) =>
                        setCustomProfitRange((range) => ({
                          ...range,
                          from: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="To">
                    <input
                      type="date"
                      value={customProfitRange.to}
                      min={customProfitRange.from}
                      onChange={(event) =>
                        setCustomProfitRange((range) => ({
                          ...range,
                          to: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              )}
              <div className={styles["company-profit-filters"]}>
                <label>
                  <span>Period</span>
                  <select
                    value={profitPeriod}
                    onChange={(event) => setProfitPeriod(event.target.value)}
                  >
                    <option value="DAY">Day</option>
                    <option value="WEEK">Week</option>
                    <option value="MONTH">Month</option>
                    <option value="YEAR">Year</option>
                    <option value="ALL">All time</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </label>
                <label>
                  <span>Company</span>
                  <select
                    value={profitCompanyFilter}
                    onChange={(event) => setProfitCompanyFilter(event.target.value)}
                  >
                    <option value="">All companies</option>
                    {profitSummary.companies.map((company) => (
                      <option key={company.companyId} value={company.companyId}>
                        {company.companyName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Profit status</span>
                  <select
                    value={profitStatusFilter}
                    onChange={(event) => setProfitStatusFilter(event.target.value)}
                  >
                    <option value="ALL">All</option>
                    <option value="PROFIT">Profit</option>
                    <option value="LOSS">Loss</option>
                    <option value="BREAK_EVEN">Break-even</option>
                  </select>
                </label>
                <span className={styles["company-profit-filter-count"]}>
                  <strong>{visibleProfitCompanies.length}</strong> companies ·{" "}
                  <strong className={styles["company-profit-supplies-count"]}>
                    {visibleProfitCompanies.reduce(
                      (total, company) =>
                        total + Number(company.supplyCount || 0),
                      0,
                    )}
                  </strong>{" "}
                  supplies
                </span>
              </div>
              <div className={styles["company-profit-strip"]}>
                <article className={styles["company-profit-total"]}>
                  <small>
                    {profitCompanyFilter || profitStatusFilter !== "ALL"
                      ? "Filtered profit"
                      : "Total profit"}
                  </small>
                  <strong
                    className={
                      Number(visibleTotalProfit) < 0
                        ? styles["company-assignment-loss"]
                        : styles["company-assignment-profit"]
                    }
                  >
                    {profitLoading ? "…" : money(visibleTotalProfit)}
                  </strong>
                  <small>
                    <span className={styles["company-profit-labour-days-count"]}>
                      {visibleProfitCompanies.reduce(
                        (total, company) =>
                          total + Number(company.labourDays || 0),
                        0,
                      )}
                    </span>{" "}
                    labour-days ·{" "}
                    <span className={styles["company-profit-supplies-count"]}>
                      {visibleProfitCompanies.reduce(
                        (total, company) =>
                          total + Number(company.supplyCount || 0),
                        0,
                      )}
                    </span>{" "}
                    supplies
                  </small>
                </article>
                {visibleProfitCompanies.map((company) => (
                  <article
                    className={styles["company-profit-item"]}
                    key={company.companyId}
                    title={company.companyName}
                  >
                    <small>{company.companyName}</small>
                    <strong
                      className={
                        Number(company.profit) < 0
                          ? styles["company-assignment-loss"]
                          : styles["company-assignment-profit"]
                      }
                    >
                      {profitLoading ? "…" : money(company.profit)}
                    </strong>
                    <div className={styles["company-profit-details"]}>
                      <span>
                        <small>Supplies</small>
                        <strong className={styles["company-profit-supplies-count"]}>
                          {company.supplyCount || 0}
                        </strong>
                      </span>
                      <span>
                        <small>Labour-days</small>
                        <strong className={styles["company-profit-labour-days-count"]}>
                          {company.labourDays || 0}
                        </strong>
                      </span>
                    </div>
                    <small className={styles["company-profit-last-supply"]}>
                      {company.lastSupply
                        ? `Latest: ${company.lastSupply.labourCount} labour${company.lastSupply.zone ? ` · ${company.lastSupply.zone}` : ""} · ${date(company.lastSupply.startDate)} – ${company.lastSupply.endDate ? date(company.lastSupply.endDate) : "Ongoing"}`
                        : "No supply in selected period"}
                    </small>
                  </article>
                ))}
                {!profitLoading && !visibleProfitCompanies.length && (
                  <span className={styles["company-profit-empty"]}>
                    No companies match these filters for this period.
                  </span>
                )}
              </div>
            </>
          )}
        </Panel>
      )}
      {isOwner && (
        <Panel
          title={
            <span className={styles["company-detail-heading"]}>
              <BarChart3 size={16} />
              Labour-wise Profit Sheet
            </span>
          }
          detail="Company billing and labour salary are calculated from saved attendance and the effective rates for each work date. Expenses are excluded."
          className={styles["company-detail-panel"]}
        >
          {detailError && <ErrorNote error={detailError} />}
          <div className={styles["company-report-filters"]}>
            <Field label="Company">
              <select
                value={selectedCompanyId}
                onChange={(event) => {
                  setSelectedCompanyId(event.target.value);
                  setDetailPage(1);
                  setSelectedWorkers(null);
                  setAppliedSelectedWorkers(null);
                  setDetailZone("");
                  setAppliedDetailZone("");
                  setDetailTeam("");
                  setAppliedDetailTeam("");
                  setZoneRateForm((current) => ({ ...current, zone: "" }));
                }}
              >
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input
                type="date"
                value={detailRange.from}
                max={detailRange.to}
                onChange={(event) =>
                  setDetailRange((range) => ({ ...range, from: event.target.value }))
                }
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={detailRange.to}
                min={detailRange.from}
                onChange={(event) =>
                  setDetailRange((range) => ({ ...range, to: event.target.value }))
                }
              />
            </Field>
            <Field label="Zone">
              <select
                value={detailZone}
                onChange={(event) => {
                  setDetailZone(event.target.value);
                  setSelectedWorkers(null);
                }}
              >
                <option value="">All zones</option>
                {(companyOverview?.zones || []).map((zone) => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </Field>
            <Field label="Team">
              <select
                value={detailTeam}
                onChange={(event) => {
                  setDetailTeam(event.target.value);
                  setSelectedWorkers(null);
                }}
              >
                <option value="">All teams</option>
                {(companyOverview?.teams || []).map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </Field>
            <div className={styles["company-report-labour-picker"]}>
              <span>Labour</span>
              <Button
                type="button"
                className={styles["company-report-picker-trigger"]}
                aria-expanded={labourMenuOpen}
                onClick={() => setLabourMenuOpen((open) => !open)}
              >
                {selectedWorkers === null ? "All labour" : `${selectedWorkers.length} selected`}
                <ChevronDown size={14} />
              </Button>
              {labourMenuOpen && (
                <div className={styles["company-report-picker-menu"]}>
                  <label className={styles["company-report-search"]}>
                    <Search size={14} />
                    <input
                      value={labourSearch}
                      onChange={(event) => setLabourSearch(event.target.value)}
                      placeholder="Search labour"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedWorkers(null)}
                  >
                    Select all labour
                  </button>
                  {availableLabours
                    .filter((labour) =>
                      labour.name.toLocaleLowerCase().includes(labourSearch.toLocaleLowerCase()),
                    )
                    .map((labour) => (
                      <label key={labour.id}>
                        <input
                          type="checkbox"
                          checked={
                            selectedWorkers === null ||
                            selectedWorkers.includes(String(labour.id))
                          }
                          onChange={(event) =>
                            setSelectedWorkers((current) => {
                              const allIds = availableLabours.map(
                                (option) => String(option.id),
                              );
                              const selected = current === null ? allIds : current;
                              return event.target.checked
                                ? [...new Set([...selected, String(labour.id)])]
                                : selected.filter((id) => id !== String(labour.id));
                            })
                          }
                        />
                        <span>{labour.name}</span>
                        <small>{labour.team}</small>
                      </label>
                    ))}
                </div>
              )}
            </div>
            <div className={styles["company-report-filter-actions"]}>
              <Button
                type="button"
                className={styles["button-primary"]}
                onClick={applyReportFilters}
              >
                Apply filters
              </Button>
              <Button
                type="button"
                className={styles["button-secondary"]}
                onClick={resetReportFilters}
              >
                Reset
              </Button>
            </div>
            <div className={styles["company-report-exports"]}>
              <Button type="button" className={styles["button-secondary"]} disabled={exporting || detailLoading || Boolean(detailError) || !overviewMatchesCompany} onClick={exportReportPdf}>
                <FileDown size={15} /> PDF
              </Button>
              <Button type="button" className={styles["button-secondary"]} disabled={exporting || detailLoading || Boolean(detailError) || !overviewMatchesCompany} onClick={exportReportExcel}>
                <FileDown size={15} /> Excel
              </Button>
            </div>
          </div>
          {detailLoading && !overviewMatchesCompany ? (
            <Empty title="Loading company details…" />
          ) : overviewMatchesCompany ? (
            <>
              {detailLoading && (
                <p role="status" aria-live="polite">
                  Updating the report with the selected filters…
                </p>
              )}
              <div className={styles["company-detail-summary"]}>
                {[
                  ["Company rate / day", rateLabel(companyOverview.rateSummary.companyDaily), "billing"],
                  ["Labour rate / day", rateLabel(companyOverview.rateSummary.labourDaily), "salary"],
                  ["Company OT / hour", rateLabel(companyOverview.rateSummary.companyOvertime), "billing"],
                  ["Labour OT / hour", rateLabel(companyOverview.rateSummary.labourOvertime), "salary"],
                  ["Duty profit", money(companyOverview.totals.dutyProfit), "margin", companyOverview.totals.dutyProfit < 0],
                  ["OT profit", money(companyOverview.totals.overtimeProfit), "margin", companyOverview.totals.overtimeProfit < 0],
                  ["Total profit", money(companyOverview.totals.margin), "margin", companyOverview.totals.margin < 0],
                ].map(([label, value, tone, negative]) => (
                  <article
                    className={`${styles[`company-detail-${tone}`]} ${negative ? styles["company-assignment-loss"] : ""}`}
                    key={label}
                  >
                    <Building2 size={18} />
                    <span>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </span>
                  </article>
                ))}
              </div>
              <div className={styles["company-detail-breakdown"]}>
                <h3>Labour profitability by attendance</h3>
                <p>
                  {rangeLabel(appliedDetailRange)} · {appliedDetailZone || "All zones"} · {appliedDetailTeam || "All teams"} · Daily and overtime values use saved effective-date rate snapshots. Expenses are excluded.
                </p>
                <div className={styles["table-wrap"]}>
                  <table className={styles["company-detail-table"]}>
                    <colgroup>
                      <col className={styles["company-detail-col-labour"]} />
                      <col className={styles["company-detail-col-zone"]} />
                      <col className={styles["company-detail-col-days"]} />
                      <col className={styles["company-detail-col-days"]} />
                      <col className={styles["company-detail-col-overtime"]} />
                      {Array.from({ length: 7 }, (_, index) => (
                        <col className={styles["company-detail-col-money"]} key={index} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Labour</th>
                        <th>Team</th>
                        <th>Zone</th>
                        <th>Days</th>
                        <th>OT hours</th>
                        <th>Company rate/day</th>
                        <th>Labour rate/day</th>
                        <th>Company OT/hr</th>
                        <th>Labour OT/hr</th>
                        <th>Duty profit</th>
                        <th>OT profit</th>
                        <th>Total profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyOverview.workers.map((worker) => (
                        <Fragment key={worker.id}>
                          <tr>
                            <th>{worker.name}</th>
                            <td>{worker.team}</td>
                            <td>{worker.zone}</td>
                            <td>{worker.days}</td>
                            <td>{worker.overtimeHours}</td>
                            <td>{rateLabel(worker.rates.companyDaily)}</td>
                            <td>{rateLabel(worker.rates.labourDaily)}</td>
                            <td>{rateLabel(worker.rates.companyOvertime)}</td>
                            <td>{rateLabel(worker.rates.labourOvertime)}</td>
                            <td>{money(worker.dutyProfit)}</td>
                            <td>{money(worker.overtimeProfit)}</td>
                            <td
                              className={
                                worker.companyBilling - worker.labourSalary < 0
                                  ? styles["company-assignment-loss"]
                                  : styles["company-assignment-profit"]
                              }
                            >
                              {money(worker.companyBilling - worker.labourSalary)}
                            </td>
                          </tr>
                          <tr className={styles["company-worker-rates-row"]}>
                            <td colSpan="12">
                              <LabourRateEditor
                                worker={worker}
                                onSave={saveWorkerRates}
                                saving={savingRateFor === worker.id}
                              />
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                      {!companyOverview.workers.length && (
                        <tr>
                          <td colSpan="12">
                            <Empty title="No labour found for this company and zone" />
                          </td>
                        </tr>
                      )}
                      <tr className={styles["company-detail-total"]}>
                        <th>TOTAL</th>
                        <td />
                        <td />
                        <td>{companyOverview.totals.days}</td>
                        <td>{companyOverview.totals.overtimeHours}</td>
                        <td colSpan="4" />
                        <td>{money(companyOverview.totals.dutyProfit)}</td>
                        <td>{money(companyOverview.totals.overtimeProfit)}</td>
                        <td>{money(companyOverview.totals.margin)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className={styles["workforce-pagination"]}>
                  <label>
                    Show
                    <select
                      value={detailPageSize}
                      onChange={(event) => {
                        setDetailPageSize(Number(event.target.value));
                        setDetailPage(1);
                      }}
                    >
                      {[10, 25, 50].map((size) => (
                        <option value={size} key={size}>{size}</option>
                      ))}
                    </select>
                    entries
                  </label>
                  <span>
                    {companyOverview.pagination.total
                      ? `${(detailPage - 1) * detailPageSize + 1}–${Math.min(detailPage * detailPageSize, companyOverview.pagination.total)} of ${companyOverview.pagination.total}`
                      : "0 entries"}
                  </span>
                  <div>
                    <Button
                      type="button"
                      className={styles["button-ghost"]}
                      disabled={detailPage <= 1 || detailLoading}
                      onClick={() => setDetailPage((page) => page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      className={styles["button-ghost"]}
                      disabled={
                        detailPage >= companyOverview.pagination.pages ||
                        detailLoading
                      }
                      onClick={() => setDetailPage((page) => page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : detailError ? (
            <Empty title="Unable to load the labour profitability report" />
          ) : (
            <Empty title="Select a company to view its labour details" />
          )}
        </Panel>
      )}
      {canEdit && formOpen && (
        <Modal
          title={editingId ? "Edit company/client" : "Add company/client"}
          onClose={() => {
            if (!saving) resetForm();
          }}
        >
          <form
            className={`${styles["form-grid"]} ${styles["company-client-form"]}`}
            onSubmit={save}
          >
            <ErrorNote error={error} />
            <Field label="Company/client name" hint="Required">
              <input
                required
                maxLength={150}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="e.g. ABC Construction"
              />
            </Field>
            <div className={styles["company-zone-group"]}>
              <div>
                <strong>Zones / cities</strong>
                <small>Add each zone with its company and labour day / overtime rates.</small>
              </div>
              <div className={styles["company-zone-edit-list"]}>
                {form.zones.map((row, index) => (
                  <div className={styles["company-zone-edit-row"]} key={index}>
                    <Field label={`Zone ${index + 1}`}>
                      <input
                        required
                        maxLength={100}
                        value={row.zone}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            zones: current.zones.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, zone: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        placeholder="e.g. Mumbai"
                      />
                    </Field>
                    {isOwner ? (
                      <>
                        <Field label="Company rate (₹/day)">
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.companyDailyRate}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                zones: current.zones.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, companyDailyRate: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Labour rate (₹/day)">
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.labourDailyRate}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                zones: current.zones.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, labourDailyRate: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Company OT (₹/hr)">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.overtimeHourlyRate}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                zones: current.zones.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, overtimeHourlyRate: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Labour OT (₹/hr)">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.labourOvertimeRate}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                zones: current.zones.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, labourOvertimeRate: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </Field>
                      </>
                    ) : (
                      <small className={styles["company-zone-edit-owner-only"]}>
                        Rates can be managed by the owner.
                      </small>
                    )}
                    <Button
                      type="button"
                      className={styles["button-ghost"]}
                      disabled={form.zones.length === 1}
                      aria-label={`Remove zone ${index + 1}`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          zones: current.zones.filter(
                            (_item, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  className={styles["button-secondary"]}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      zones: [...current.zones, blankZoneRate()],
                    }))
                  }
                >
                  <Plus size={15} /> Add zone
                </Button>
              </div>
            </div>
            {isOwner && (
              <Field
                label="Rates effective from"
                hint="Existing attendance and rates before this date stay unchanged."
              >
                <input
                  required
                  type="date"
                  value={form.applicableFrom}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      applicableFrom: event.target.value,
                    }))
                  }
                />
              </Field>
            )}
            <div className={`${styles["modal-actions"]} ${styles["company-client-form-actions"]}`}>
              {editingId && (
                <Button
                  type="button"
                  className={styles["button-secondary"]}
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}
              <AddButton type="submit" loading={saving}>
                {editingId ? "Save changes" : "Add company"}
              </AddButton>
            </div>
          </form>
        </Modal>
      )}
      {trackingCompany && (
        <Modal
          wide
          title={`Labour tracking · ${trackingCompany.name}`}
          onClose={() => {
            setTrackingCompany(null);
            setAssignmentFormOpen(false);
          }}
        >
          <div className={styles["company-assignment-modal"]}>
            <ErrorNote error={assignmentError} />
            {canEdit && !assignmentFormOpen && (
              <div className={styles["company-assignment-add-action"]}>
                <AddButton
                  onClick={() => {
                    setAssignmentError("");
                    setAssignmentForm(blankAssignment());
                    setEditingAssignmentId("");
                    setAssignmentFormOpen(true);
                  }}
                >
                  Record labour
                </AddButton>
              </div>
            )}
            {canEdit && assignmentFormOpen && (
              <form
                className={`${styles["form-grid"]} ${styles["company-assignment-form"]}`}
                onSubmit={saveAssignment}
              >
                <Field label="Number of labourers">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={assignmentForm.labourCount}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        labourCount: event.target.value,
                      }))
                    }
                    placeholder="e.g. 8"
                  />
                </Field>
                <Field label="Zone">
                  {trackingCompany.zones?.length ? (
                    <select
                      required
                      value={assignmentForm.zone}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          zone: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select zone</option>
                      {trackingCompany.zones.map((zone) => (
                        <option value={zone} key={zone}>{zone}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      maxLength={100}
                      value={assignmentForm.zone}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          zone: event.target.value,
                        }))
                      }
                      placeholder="e.g. Chennai"
                    />
                  )}
                </Field>
                <Field label="From date">
                  <input
                    type="date"
                    required
                    value={assignmentForm.startDate}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </Field>
                <label className={styles["company-assignment-ongoing"]}>
                  <input
                    type="checkbox"
                    checked={assignmentForm.ongoing}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        ongoing: event.target.checked,
                        endDate: event.target.checked ? "" : current.endDate,
                      }))
                    }
                  />
                  Work is ongoing (profit counted through today)
                </label>
                {!assignmentForm.ongoing && (
                  <Field label="Actual end date">
                    <input
                      type="date"
                      required
                      min={assignmentForm.startDate}
                      value={assignmentForm.endDate}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                )}
                <div className={`${styles["modal-actions"]} ${styles["company-assignment-actions"]}`}>
                  <Button
                    type="button"
                    className={styles["button-secondary"]}
                    onClick={() => {
                      setAssignmentFormOpen(false);
                      setEditingAssignmentId("");
                      setAssignmentForm(blankAssignment());
                    }}
                    disabled={assignmentSaving}
                  >
                    Cancel
                  </Button>
                  <AddButton type="submit" loading={assignmentSaving}>
                    {editingAssignmentId ? "Save changes" : "Save record"}
                  </AddButton>
                </div>
              </form>
            )}
            <div className={styles["company-assignment-history-head"]}>
              <h3>Assignment history</h3>
              <Field label={isOwner ? "Profit period" : "Period"}>
                <select
                  value={assignmentPeriod}
                  onChange={(event) => setAssignmentPeriod(event.target.value)}
                >
                  <option value="DAY">Day</option>
                  <option value="WEEK">Week</option>
                  <option value="MONTH">Month</option>
                  <option value="YEAR">Year</option>
                  <option value="ALL">All time</option>
                </select>
              </Field>
            </div>
            <div className={styles["company-assignment-summary"]}>
              <article>
                <small>Labour-days in period</small>
                <strong>{Number(assignmentSummary.labourDays || 0).toLocaleString("en-IN")}</strong>
              </article>
              {isOwner && (
                <article>
                  <small>Profit / loss in period</small>
                  <strong
                    className={
                      Number(assignmentSummary.profit || 0) < 0
                        ? styles["company-assignment-loss"]
                        : styles["company-assignment-profit"]
                    }
                  >
                    {money(assignmentSummary.profit || 0)}
                  </strong>
                  <small>Rate difference × labour-days</small>
                </article>
              )}
            </div>
            {assignmentLoading ? (
              <Empty title="Loading labour records…" />
            ) : assignments.length ? (
              <div className={styles["company-assignment-list"]}>
                {assignments.map((assignment) => (
                  <article key={assignment._id}>
                    <div>
                      <strong>{assignment.labourCount} labour</strong>
                      <small>
                        {date(assignment.startDate)} –{" "}
                        {assignment.endDate ? date(assignment.endDate) : "Ongoing"}
                        {assignment.zone ? ` · ${assignment.zone}` : ""}
                      </small>
                    </div>
                    <div>
                      <small>
                        {assignment.periodDays} {assignment.periodDays === 1 ? "day" : "days"} in selected period
                      </small>
                      <strong>
                        {Number(assignment.labourDays || 0).toLocaleString("en-IN")} labour-days
                      </strong>
                    </div>
                    {(isOwner || canEdit) && (
                      <div className={styles["company-assignment-row-end"]}>
                        {isOwner && (
                          <strong
                            className={
                              Number(assignment.profit || 0) < 0
                                ? styles["company-assignment-loss"]
                                : styles["company-assignment-profit"]
                            }
                          >
                            {money(assignment.profit || 0)}
                          </strong>
                        )}
                        {canEdit && (
                          <div className={styles["company-assignment-actions-inline"]}>
                            <Button
                              type="button"
                              className={styles["button-secondary"]}
                              onClick={() => editAssignment(assignment)}
                              aria-label={`Edit labour record for ${assignment.labourCount} labourers`}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              type="button"
                              className={styles["button-danger"]}
                              onClick={() => setDeletingAssignment(assignment)}
                              aria-label={`Delete labour record for ${assignment.labourCount} labourers`}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="No labour records for this period"
                detail={canEdit ? "Record the labour count and dates above." : "No labour was recorded for this period."}
              />
            )}
          </div>
        </Modal>
      )}
      {deletingAssignment && (
        <DeleteConfirm
          itemLabel={`${deletingAssignment.labourCount} labour record for ${trackingCompany.name}`}
          onClose={() => setDeletingAssignment(null)}
          onConfirm={deleteAssignment}
        />
      )}
      {deletingCompany && (
        <DeleteConfirm
          itemLabel={`${deletingCompany.name}, including its rate and labour supply history`}
          onClose={() => setDeletingCompany(null)}
          onConfirm={permanentlyDeleteCompany}
        />
      )}
    </>
  );
}
