import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Select,
  MenuItem,
  Autocomplete,
  Snackbar,
  Alert,
} from "@mui/material";
import { createJob } from "../api";
import usePlanMeta from '../hooks/usePlanMeta';
import QuillEditor from '../components/QuillEditor'; // Added import for QuillEditor
import PropTypes from 'prop-types';

const jobTitles = [
  "Software Engineer",
  "Product Manager",
  "Designer",
  "Data Scientist",
];
const jobCategories = [
  "Engineering",
  "Software Development",
  "Data Science",
  "AI / Machine Learning",
  "Design",
  "Product Management",
  "Project Management",
  "Quality Assurance",
  "DevOps / SRE",
  "IT & Networking",
  "Cybersecurity",
  "Cloud Computing",
  "Marketing",
  "Sales",
  "Human Resources",
  "Finance",
  "Operations",
  "Customer Support",
  "Business Development",
  "Content & Copywriting",
  "Legal",
  "Education & Training",
  "Healthcare / MedTech",
  "Hardware / Embedded",
  "Analytics & BI",
  "Research & Development",
  "Other",
];

export default function PostJob({ isDarkMode, email, userCompany }) {
  // Add email prop
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState({
    jobTitle: "",
    jobDescription: "",
    employmentType: "",
    experienceLevel: "",
    remoteOrOnsite: "",
    location: "",
    salary: "",
  relocationBenefits: "",
    equity: "",
    sponsorship: "",
    recruitmentProcess: "",
    responsibilities: "",
    skills: "",
    benefits: "",
    eligibility: "",
    companyDescription: "",
    additionalInformation: "",
    status: "",
    numberOfPositions: "",
    category: "",
    tags: "",
    validUntil: "", // New Job Validity field (date-only YYYY-MM-DD)
    postedAt: new Date().toISOString(), // Set the real-time date
    companyEmail: email, // Add company email to form data
  });

  // Update companyEmail whenever the email prop changes
  useEffect(() => {
    if (email) {
      setFormData((prev) => ({
        ...prev,
        companyEmail: email,
      }));
    }
  }, [email]);

  const companyEmail = (userCompany && userCompany.email) || email;
  const { planMeta } = usePlanMeta(companyEmail);

  const blockers = useMemo(() => {
    const issues = [];
    if (!userCompany) return issues;
    if (userCompany.status === 'hold') issues.push('Your account is on hold. Check Messages for details.');
    if (userCompany.status === 'denied') issues.push('Your account has been denied. Contact support.');
    if (userCompany.approved === false) issues.push('Your account is not approved yet.');
    if (userCompany.emailVerified === false) issues.push('Verify your email before posting jobs.');
    if (userCompany.profileCompleted === false) issues.push('Complete your company profile before posting jobs.');
    if (userCompany.subscriptionEndsAt && new Date(userCompany.subscriptionEndsAt) < new Date()) {
      issues.push('Your subscription has expired. Upgrade to post jobs.');
    }
    if (planMeta && typeof planMeta.remaining === 'number' && planMeta.remaining <= 0) {
      issues.push('Job post limit reached for your plan. Upgrade or deactivate existing jobs.');
    }
    return issues;
  }, [userCompany, planMeta]);

  // Cities selection not used currently
  const [openSnackbar, setOpenSnackbar] = useState(false); // State for Snackbar
  const [jdFiles, setJdFiles] = useState([]);
  const [jdError, setJdError] = useState("");
  const [validityError, setValidityError] = useState("");
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email) {
      alert("You must be logged in to post a job");
      navigate("/");
      return;
    }

    try {
      // Validate file if present
      if (jdFiles && jdFiles.length) {
        for (const f of jdFiles) {
          const name = f.name.toLowerCase();
          const valid = name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx');
          if (!valid) {
            setJdError('Only PDF, DOC, DOCX are allowed');
            return;
          }
          if (f.size > 10 * 1024 * 1024) {
            setJdError('Each file must be less than 10MB');
            return;
          }
        }
      }

      // Validate Job Validity for paid plans (required) & constraints
      setValidityError("");
      if (planMeta && planMeta.paid) {
        if (!formData.validUntil) {
          setValidityError("Select a Job Validity date (required for paid plan)");
          return;
        }
        const today = new Date();
        const chosen = new Date(formData.validUntil + 'T00:00:00');
        if (chosen < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
          setValidityError("Validity date cannot be in the past");
          return;
        }
        if (planMeta.endsAt && chosen > planMeta.endsAt) {
          setValidityError("Validity cannot exceed subscription end date");
          return;
        }
      } else if (planMeta && !planMeta.paid) {
        // Free plan: optional; if provided still validate not past
        if (formData.validUntil) {
          const chosen = new Date(formData.validUntil + 'T00:00:00');
          if (chosen < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) {
            setValidityError("Validity date cannot be in the past");
            return;
          }
        }
      }

      // Build payload: use FormData when file is present
  let payload;
  const headers = {};
      if (jdFiles && jdFiles.length) {
        payload = new FormData();
        Object.entries({ ...formData, companyEmail: email }).forEach(([k, v]) => {
          if (typeof v !== 'undefined' && v !== null) payload.append(k, v);
        });
        jdFiles.forEach(file => payload.append('jdFiles', file));
        headers['Content-Type'] = 'multipart/form-data';
      } else {
        payload = { ...formData, companyEmail: email };
        headers['Content-Type'] = 'application/json';
      }

      setSubmitError('');
      await createJob(payload, { headers });
      setOpenSnackbar(true);

      // Add navigation after successful post
      setTimeout(() => {
        navigate("/job-posted");
      }, 2000);
  } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
      setSubmitError(serverMsg || err?.message || 'Job posting failed');
    }
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  // Custom styling for Material-UI components in dark mode
  // Styles handled inline in components

  return (
    <div
      className={`min-h-screen flex items-center justify-center py-8 px-2 sm:px-6 lg:px-8 ${
        isDarkMode ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white" : "bg-gradient-to-br from-orange-50 via-white to-orange-100 text-black"
      }`}
    >
      {blockers.length > 0 && (
        <div className={`w-full max-w-3xl mx-auto mb-6 p-4 rounded border ${isDarkMode ? 'bg-yellow-900/20 border-yellow-700 text-yellow-200' : 'bg-yellow-50 border-yellow-200 text-yellow-900'}`}>
          <div className="font-semibold mb-1">Posting disabled</div>
          <ul className="text-sm list-disc pl-5 space-y-1">
            {blockers.map((msg, idx) => (
              <li key={`${msg}-${idx}`}>{msg}</li>
            ))}
          </ul>
          <div className="text-sm mt-2">See <a href="/messages" className="underline text-[#ff8200]">Messages</a> for admin notes.</div>
        </div>
      )}
      <div
        className={`w-full max-w-3xl mx-auto rounded-3xl shadow-2xl border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-orange-200"
        } p-6 sm:p-10`}
      >
        <div className="flex flex-col items-center mb-8 gap-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight bg-gradient-to-r from-[#ff8200] to-[#ffb347] bg-clip-text text-transparent drop-shadow-lg">
            Create a Job Post
          </h1>
          {submitError && (
            <div className={`w-full mt-2 p-3 rounded text-sm border ${isDarkMode ? 'bg-red-900/30 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {submitError}
            </div>
          )}
          {planMeta && (
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="relative flex items-center justify-center" style={{ width: 54, height: 54 }}>
                {(() => {
                  const pct = planMeta.limit ? ((planMeta.limit - planMeta.remaining) / planMeta.limit) * 100 : 0;
                  const stroke = 6;
                  const r = 24 - stroke/2;
                  const circ = 2 * Math.PI * r;
                  const offset = circ - (pct/100) * circ;
                  return (
                    <svg width={54} height={54} className="rotate-[-90deg]">
                      <circle cx={27} cy={27} r={r} stroke={isDarkMode ? '#374151' : '#f3f4f6'} strokeWidth={stroke} fill="none" />
                      <circle
                        cx={27}
                        cy={27}
                        r={r}
                        stroke={planMeta.remaining > 0 ? '#ff8200' : '#dc2626'}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        fill="none"
                        className="transition-all duration-500 ease-out"
                      />
                      <text
                        x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
                        className="rotate-[90deg] fill-current"
                        style={{ fontSize: '10px', fontWeight: 600, fill: isDarkMode ? '#fff' : '#111' }}
                        transform="rotate(90 27 27)"
                      >{Math.round(pct)}%</text>
                    </svg>
                  );
                })()}
              </div>
              <div className="flex flex-col gap-1">
                <span className={`px-2 py-1 w-fit rounded-full border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-orange-300 text-orange-800'} bg-white/10`}>{planMeta.plan} plan</span>
                <span className={`px-2 py-1 w-fit rounded-full ${planMeta.remaining>0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{planMeta.remaining} / {planMeta.limit} posts remaining</span>
              </div>
            </div>
          )}
        </div>
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-6 border-b pb-2 border-dashed border-orange-300">
              Job Details
            </h2>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Job Title</label>
              <Autocomplete
                freeSolo
                options={jobTitles}
                value={formData.jobTitle}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, jobTitle: newValue });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    fullWidth
                    className="focus:border-blue-500"
                    inputProps={{
                      ...params.inputProps,
                      style: { color: isDarkMode ? 'white' : 'inherit' }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                        },
                        '&:hover fieldset': {
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.23)',
                        }
                      }
                    }}
                  />
                )}
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Job Description</label>
              <QuillEditor
                value={formData.jobDescription}
                onChange={(content) => setFormData({...formData, jobDescription: content})}
                isDarkMode={isDarkMode}
                placeholder="Enter detailed job description..."
              />
            </div>
            <div className="mb-6 flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-1/2">
                <label className="block mb-2 font-medium">Employment Type</label>
                <Select
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
                  fullWidth
                  sx={{
                    color: isDarkMode ? 'white' : 'inherit',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                    },
                    '& .MuiSvgIcon-root': {
                      color: isDarkMode ? 'white' : 'inherit',
                    }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { backgroundColor: 'white' } // White background for dropdown
                    }
                  }}
                >
                  <MenuItem value="">Select Employment Type</MenuItem>
                  <MenuItem value="freelance">Freelance</MenuItem>
                  <MenuItem value="full-time">Full-time</MenuItem>
                  <MenuItem value="part-time">Part-time</MenuItem>
                  <MenuItem value="contract">Contract</MenuItem>
                </Select>
              </div>

              <div className="w-full sm:w-1/2">
                <label className="block mb-2 font-medium">Experience Level</label>
                <Select
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleChange}
                  fullWidth
                  sx={{
                    color: isDarkMode ? 'white' : 'inherit',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                    },
                    '& .MuiSvgIcon-root': {
                      color: isDarkMode ? 'white' : 'inherit',
                    }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { backgroundColor: 'white' } // White background for dropdown
                    }
                  }}
                >
                  <MenuItem value="">Select Experience (years)</MenuItem>
                  <MenuItem value="0-2 years">0-2 years</MenuItem>
                  <MenuItem value="3-5 years">3-5 years</MenuItem>
                  <MenuItem value="6-8 years">6-8 years</MenuItem>
                  <MenuItem value="9-12 years">9-12 years</MenuItem>
                  <MenuItem value="12+ years">12+ years</MenuItem>
                </Select>
              </div>
            </div>
            <div className="mb-6 flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-1/2">
                <label className="block mb-2 font-medium">Remote or Onsite</label>
                <Select
                  name="remoteOrOnsite"
                  value={formData.remoteOrOnsite}
                  onChange={handleChange}
                  fullWidth
                  sx={{
                    color: isDarkMode ? 'white' : 'inherit',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                    },
                    '& .MuiSvgIcon-root': {
                      color: isDarkMode ? 'white' : 'inherit',
                    }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { backgroundColor: 'white' }
                    }
                  }}
                >
                  <MenuItem value="">Select Option</MenuItem>
                  <MenuItem value="remote">Remote</MenuItem>
                  <MenuItem value="onsite">Onsite</MenuItem>
                  <MenuItem value="hybrid">Hybrid</MenuItem>
                </Select>
              </div>
              <div className="w-full sm:w-1/2">
                <label className="block mb-2 font-medium">Location</label>
                <TextField
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  fullWidth
                  inputProps={{
                    style: { color: isDarkMode ? 'white' : 'inherit' }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Salary / Project Value</label>
              <TextField
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                placeholder="e.g., ₹50,000 per month or ₹2,00,000 per project"
                fullWidth
                inputProps={{
                  style: { color: isDarkMode ? 'white' : 'inherit' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                    }
                  }
                }}
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Relocation Benefits</label>
              <TextField
                name="relocationBenefits"
                value={formData.relocationBenefits}
                onChange={handleChange}
                fullWidth
                inputProps={{
                  style: { color: isDarkMode ? 'white' : 'inherit' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                    }
                  }
                }}
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Recruitment Process</label>
              <QuillEditor
                value={formData.recruitmentProcess}
                onChange={(content) => setFormData({ ...formData, recruitmentProcess: content })}
                isDarkMode={isDarkMode}
                placeholder="Describe the recruitment process (stages, rounds, timelines)..."
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Responsibilities</label>
              <QuillEditor
                value={formData.responsibilities}
                onChange={(content) => setFormData({ ...formData, responsibilities: content })}
                isDarkMode={isDarkMode}
                placeholder="List the key responsibilities..."
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Skills</label>
              <QuillEditor
                value={formData.skills}
                onChange={(content) => setFormData({ ...formData, skills: content })}
                isDarkMode={isDarkMode}
                placeholder="List required and preferred skills..."
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Benefits</label>
              <QuillEditor
                value={formData.benefits}
                onChange={(content) => setFormData({ ...formData, benefits: content })}
                isDarkMode={isDarkMode}
                placeholder="Describe compensation, perks, and benefits..."
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Eligibility</label>
              <QuillEditor
                value={formData.eligibility}
                onChange={(content) => setFormData({ ...formData, eligibility: content })}
                isDarkMode={isDarkMode}
                placeholder="Specify required qualifications or eligibility criteria..."
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Company Description</label>
              <QuillEditor
                value={formData.companyDescription}
                onChange={(content) => setFormData({ ...formData, companyDescription: content })}
                isDarkMode={isDarkMode}
                placeholder="Tell candidates about your company..."
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Additional Information</label>
              <QuillEditor
                value={formData.additionalInformation}
                onChange={(content) => setFormData({ ...formData, additionalInformation: content })}
                isDarkMode={isDarkMode}
                placeholder="Any other important details..."
              />
            </div>
            {/* JD attachments upload */}
            <div className="mb-6">
              <label className="block mb-2 font-medium">Attach JD files (PDF/DOC/DOCX, optional)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setJdError("");
                  setJdFiles(files);
                }}
                className="block w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-lg cursor-pointer focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#ff8200] file:text-white hover:file:bg-[#e57400] transition"
              />
              {jdFiles && jdFiles.length > 0 && (
                <ul className="mt-2 text-sm list-disc list-inside">
                  {jdFiles.map((f, i) => (
                    <li key={i}>{f.name}</li>
                  ))}
                </ul>
              )}
              {jdError && (
                <p className="mt-1 text-sm text-red-500">{jdError}</p>
              )}
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Status</label>
              <Select
                name="status"
                value={formData.status}
                onChange={handleChange}
                fullWidth
                sx={{
                  color: isDarkMode ? 'white' : 'inherit',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                  },
                  '& .MuiSvgIcon-root': {
                    color: isDarkMode ? 'white' : 'inherit',
                  }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { backgroundColor: 'white' }
                  }
                }}
              >
                <MenuItem value="">Select Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Number of Positions</label>
              <TextField
                name="numberOfPositions"
                value={formData.numberOfPositions}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only update if the input is a number or empty
                  if (value === "" || /^\d+$/.test(value)) {
                    setFormData({ ...formData, numberOfPositions: value });
                  }
                }}
                fullWidth
                inputProps={{
                  style: { color: isDarkMode ? 'white' : 'inherit' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                    }
                  }
                }}
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Category</label>
              <Autocomplete
                freeSolo
                options={jobCategories}
                value={formData.category}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, category: newValue });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    name="category"
                    placeholder="Select or type a category"
                    onChange={(e) => {
                      if (e.target.value) {
                        setFormData({ ...formData, category: e.target.value });
                      }
                    }}
                    fullWidth
                    inputProps={{
                      ...params.inputProps,
                      style: { color: isDarkMode ? 'white' : 'inherit' }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                        }
                      }
                    }}
                  />
                )}
                componentsProps={{
                  paper: { sx: { backgroundColor: 'white' } } // White background for dropdown
                }}
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Tags</label>
              <TextField
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                fullWidth
                inputProps={{
                  style: { color: isDarkMode ? 'white' : 'inherit' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.23)',
                    }
                  }
                }}
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-medium">Job Validity (Expiry Date){planMeta?.paid ? ' *' : ''}</label>
              <input
                type="date"
                name="validUntil"
                value={formData.validUntil}
                onChange={(e) => {
                  setValidityError('');
                  setFormData({ ...formData, validUntil: e.target.value });
                }}
                min={new Date().toISOString().slice(0,10)}
                max={planMeta?.endsAt ? new Date(planMeta.endsAt.getTime() - (planMeta.endsAt.getTimezoneOffset()*60000)).toISOString().slice(0,10) : undefined}
                className={`w-full rounded-md border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff8200] ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
              <p className="mt-2 text-xs text-gray-500">
                {planMeta?.paid && planMeta?.endsAt && `Must be on or before ${planMeta.endsAt.toISOString().slice(0,10)}`}
                {!planMeta?.paid && 'Optional for Free plan; leave blank for indefinite.'}
              </p>
              {validityError && (
                <p className="mt-1 text-sm text-red-600">{validityError}</p>
              )}
            </div>
          </div>
          <button
            type="submit"
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition duration-300 ${
              isDarkMode
                ? "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white hover:from-[#e57400] hover:to-[#ffb347]"
                : "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white hover:from-[#e57400] hover:to-[#ffb347]"
            }`}
          >
            Post Job
          </button>
        </form>
        <Snackbar
          open={openSnackbar}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          sx={{ width: "100%" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity="success"
            sx={{
              width: "100%",
              maxWidth: "600px",
              fontSize: "1.1rem",
              borderRadius: "12px",
              background: isDarkMode
                ? "linear-gradient(90deg, #232526 0%, #ff8200 100%)"
                : "linear-gradient(90deg, #fffbe6 0%, #ffb347 100%)",
              color: isDarkMode ? "white" : "#232526",
              "& .MuiAlert-message": { fontSize: "1.1rem" },
            }}
          >
            Job posted successfully
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
}
PostJob.propTypes = {
  isDarkMode: PropTypes.bool,
  email: PropTypes.string,
  userCompany: PropTypes.object
};
