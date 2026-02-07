const express = require('express');
const router = express.Router();
const { getAllPlans, getPlanById, getPlanByMonths, createPlan, updatePlan, deletePlan} = require('../controllers/plansController');
const { protect } = require('../middleware/authMiddleware');

// Protected routes - require authentication
router.get('/', protect, getAllPlans);
router.get('/:id', protect, getPlanById);
router.get('/months/:months', protect, getPlanByMonths);
router.post("/add-plan", protect, createPlan);
router.put("/:id", protect, updatePlan);
router.delete("/:id", protect, deletePlan);

module.exports = router;
