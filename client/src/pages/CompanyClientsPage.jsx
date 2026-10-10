import { useEffect, useState } from "react";
import {
  Building2,
  ClipboardList,
  Pencil,
  RotateCcw,
  Trash2,
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

const blankForm = {
  name: "",
  companyLabourRate: "",
  originalLabourRate: "",
};

const localDateInput = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const blankAssignment = () => {
  const today = localDateInput(new Date());
  return { labourCount: "", startDate: today, endDate: today };
};

export function CompanyClientsPage({ canEdit = false, isOwner = false }) {
  const [companies, setCompanies] = useState([]);
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
    setForm(blankForm);
    setFormOpen(false);
  };

  const addCompany = () => {
    setEditingId("");
    setForm(blankForm);
    setFormOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const companyData = isOwner
        ? form
        : {
            name: form.name,
          };
      if (editingId) {
        await request(api.patch(`/companies/${editingId}`, companyData));
      } else {
        await request(api.post("/companies", companyData));
      }
      resetForm();
      await load();
      setProfitRefresh((value) => value + 1);
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
      companyLabourRate: company.companyLabourRate ?? "",
      originalLabourRate: company.originalLabourRate ?? "",
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

  const editAssignment = (assignment) => {
    setAssignmentError("");
    setEditingAssignmentId(assignment._id);
    setAssignmentForm({
      labourCount: String(assignment.labourCount),
      startDate: new Date(assignment.startDate).toISOString().slice(0, 10),
      endDate: new Date(assignment.endDate).toISOString().slice(0, 10),
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

  return (
    <>
      <PageHeader
        title="Companies & Clients"
      />
      <ErrorNote error={error} />
      {isOwner && (
        <Panel
          title="Profit by company"
          detail={`${periodLabel(profitPeriod)} · ${rangeLabel(profitRange)} · Profit, supply count, labour-days and latest supply.`}
          className={styles["company-profit-panel"]}
          action={
            <label className={styles["company-profit-period"]}>
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
          }
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
                  {visibleProfitCompanies.length} companies ·{" "}
                  {visibleProfitCompanies.reduce(
                    (total, company) => total + Number(company.supplyCount || 0),
                    0,
                  )}{" "}
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
                    {visibleProfitCompanies.reduce(
                      (total, company) => total + Number(company.labourDays || 0),
                      0,
                    )}{" "}
                    labour-days ·{" "}
                    {visibleProfitCompanies.reduce(
                      (total, company) => total + Number(company.supplyCount || 0),
                      0,
                    )}{" "}
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
                        <strong>{company.supplyCount || 0}</strong>
                      </span>
                      <span>
                        <small>Labour-days</small>
                        <strong>{company.labourDays || 0}</strong>
                      </span>
                    </div>
                    <small className={styles["company-profit-last-supply"]}>
                      {company.lastSupply
                        ? `Latest: ${company.lastSupply.labourCount} labour · ${date(company.lastSupply.startDate)} – ${date(company.lastSupply.endDate)}`
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
            <Field label="Company labour rate (₹/day)">
              {isOwner ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.companyLabourRate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companyLabourRate: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              ) : (
                <input disabled value="Owner only" />
              )}
            </Field>
            <Field label="Original labour rate (₹/day)">
              {isOwner ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.originalLabourRate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      originalLabourRate: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              ) : (
                <input disabled value="Owner only" />
              )}
            </Field>
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
      <Panel
        title="Company & client list"
        detail="Select a saved company when adding or editing a worker."
        className={styles["company-client-list-panel"]}
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
          </div>
        }
      >
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
                  {isOwner && (
                    <small>
                      Company rate: {money(company.companyLabourRate || 0)}/day
                      {" · "}
                      Original rate: {money(company.originalLabourRate || 0)}/day
                    </small>
                  )}
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
                        <Button
                          type="button"
                          className={styles["button-secondary"]}
                          onClick={() => setActive(company, true)}
                          aria-label={`Restore ${company.name}`}
                        >
                          <RotateCcw size={15} />
                        </Button>
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
      </Panel>
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
                <Field label="To date">
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
                        {date(assignment.startDate)} – {date(assignment.endDate)}
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
    </>
  );
}
