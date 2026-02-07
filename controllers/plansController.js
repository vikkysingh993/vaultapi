const db = require("../models");
const Plan = db.Plan;

const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.findAll({
      order: [['months', 'ASC']],
    });

    if (!plans || plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No plans found',
      });
    }

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
      message: 'Plans retrieved successfully',
    });
  } catch (error) {
    console.error('âŒ Error fetching plans:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching plans',
      error: error.message,
      code: 'SERVER_ERROR',
    });
  }
};

// @desc    Get plan by ID
// @route   GET /api/plans/:id
// @access  Private (Protected - requires authentication)
const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid plan ID is required',
        code: 'INVALID_PLAN_ID',
      });
    }

    const plan = await Plan.findByPk(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
        code: 'PLAN_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
      message: 'Plan retrieved successfully',
    });
  } catch (error) {
    console.error('âŒ Error fetching plan by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching plan',
      error: error.message,
      code: 'SERVER_ERROR',
    });
  }
};

// @desc    Get plan by months
// @route   GET /api/plans/months/:months
// @access  Private (Protected - requires authentication)
const getPlanByMonths = async (req, res) => {
  try {
    const { months } = req.params;

    if (!months || isNaN(months)) {
      return res.status(400).json({
        success: false,
        message: 'Valid months parameter is required',
        code: 'INVALID_MONTHS',
      });
    }

    const plan = await Plan.findOne({
      where: { months: parseInt(months) }
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: `Plan for ${months} months not found`,
        code: 'PLAN_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
      message: 'Plan retrieved successfully',
    });
  } catch (error) {
    console.error('âŒ Error fetching plan by months:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching plan',
      error: error.message,
      code: 'SERVER_ERROR',
    });
  }
};

// CREATE PLAN
const createPlan = async (req, res) => {
  const { months, price, apy, status } = req.body;
  const plan = await Plan.create({ months, price, apy, status });
  res.json({ success: true, data: plan });
};

// UPDATE PLAN
const updatePlan = async (req, res) => {
  const { months, price, apy, status } = req.body;
  await Plan.update(
    { months, price, apy, status },
    { where: { id: req.params.id } }
  );
  res.json({ success: true });
};

// DELETE PLAN
const deletePlan = async (req, res) => {
  // await Plan.destroy({ where: { id: req.params.id } });
  await Plan.update(
  { is_active: false },
  { where: { id: req.params.id } }
);
  res.json({ success: true });
};

module.exports = {
  getAllPlans,
  getPlanById,
  getPlanByMonths,
  createPlan,
  updatePlan,
  deletePlan,
};
