import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    TrashIcon,
    PencilIcon,
    UserPlusIcon,
    XMarkIcon,
    CheckIcon,
    CameraIcon,
    PhotoIcon,
    ArrowPathIcon,
    EyeIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';

function CustomerPage() {
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    // Message system - centralized
    const [messages, setMessages] = useState([]);

    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    // Customer form
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [documentType, setDocumentType] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [documentPic, setDocumentPic] = useState(null);
    const [nationality, setNationality] = useState("Nepali");
    const [customNationality, setCustomNationality] = useState("");
    const [showCustomNationality, setShowCustomNationality] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formMode, setFormMode] = useState('create');

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingCustomer, setDeletingCustomer] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // Form validation errors
    const [formErrors, setFormErrors] = useState({});

    // Image preview modal
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [previewCustomerName, setPreviewCustomerName] = useState("");

    // Camera
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [cameras, setCameras] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState("");
    const [cameraLoading, setCameraLoading] = useState(false);
    const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const cameraDropdownRef = useRef(null);
    const videoReadyCheckRef = useRef(null);
    const fileInputRef = useRef(null);

    // Message functions
    const addMessage = (text, type = 'info', duration = 5000) => {
        const id = Date.now() + Math.random();
        setMessages(prev => [...prev, { id, text, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeMessage(id);
            }, duration);
        }
    };

    const removeMessage = (id) => {
        setMessages(prev => prev.filter(msg => msg.id !== id));
    };

    const clearMessages = () => {
        setMessages([]);
    };

    const showSuccess = (text, duration = 5000) => {
        addMessage(text, 'success', duration);
    };

    const showError = (text, duration = 5000) => {
        addMessage(text, 'error', duration);
    };

    const showInfo = (text, duration = 5000) => {
        addMessage(text, 'info', duration);
    };

    // Form validation
    const validateForm = () => {
        const errors = {};

        // Name validation - must contain space
        if (!name.trim()) {
            errors.name = 'Full name is required';
        } else if (!name.trim().includes(' ')) {
            errors.name = 'Please enter full name (first and last name)';
        } else if (name.trim().split(' ').length < 2) {
            errors.name = 'Please enter both first and last name';
        }

        // Phone validation - at least 10 digits
        const phoneDigits = phoneNumber.replace(/\D/g, '');
        if (!phoneNumber.trim()) {
            errors.phoneNumber = 'Phone number is required';
        } else if (phoneDigits.length < 10) {
            errors.phoneNumber = 'Phone number must be at least 10 digits';
        } else if (phoneDigits.length > 15) {
            errors.phoneNumber = 'Phone number cannot exceed 15 digits';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Clear a specific form error
    const clearFieldError = (field) => {
        setFormErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    };

    // Nationality options
    const nationalityOptions = [
        { value: "Nepali", label: "🇳🇵 Nepali" },
        { value: "American", label: "🇺🇸 American" },
        { value: "Indian", label: "🇮🇳 Indian" },
        { value: "Chinese", label: "🇨🇳 Chinese" },
        { value: "British", label: "🇬🇧 British" },
        { value: "Canadian", label: "🇨🇦 Canadian" },
        { value: "Australian", label: "🇦🇺 Australian" },
        { value: "Japanese", label: "🇯🇵 Japanese" },
        { value: "Korean", label: "🇰🇷 Korean" },
        { value: "German", label: "🇩🇪 German" },
        { value: "French", label: "🇫🇷 French" },
        { value: "Italian", label: "🇮🇹 Italian" },
        { value: "Spanish", label: "🇪🇸 Spanish" },
        { value: "Brazilian", label: "🇧🇷 Brazilian" },
        { value: "Mexican", label: "🇲🇽 Mexican" },
        { value: "Russian", label: "🇷🇺 Russian" },
        { value: "South African", label: "🇿🇦 South African" },
        { value: "Egyptian", label: "🇪🇬 Egyptian" },
        { value: "Other", label: "Other" },
    ];

    const documentTypeOptions = [
        { value: "", label: "Select document" },
        { value: "Aadhar", label: "Aadhar" },
        { value: "Passport", label: "Passport" },
        { value: "Driver License", label: "Driver License" },
        { value: "Voter ID", label: "Voter ID" },
        { value: "Citizenship", label: "Citizenship" },
        { value: "National ID", label: "National ID" },
        { value: "PAN Card", label: "PAN Card" },
        { value: "Other", label: "Other" },
    ];

    // ---------------------------------------------------------
    // LOAD CUSTOMERS
    // ---------------------------------------------------------

    const loadCustomers = async () => {
        setLoading(true);
        clearMessages();
        try {
            let result;

            if (search.trim() === "") {
                result = await invoke("list_customers", {
                    page: page,
                });
            } else {
                result = await invoke("search_customers", {
                    search: search,
                    page: page,
                });
            }

            setCustomers(result.customers);
            setTotalPages(result.total_pages);
            setTotal(result.total);
        } catch (error) {
            console.error(error);
            showError("Failed to load customers: " + String(error));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, [page, search]);


    // ---------------------------------------------------------
    // CAMERA FUNCTIONS
    // ---------------------------------------------------------

    async function getCameras() {
        setCameraError("");

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                throw new Error("Camera API is not supported.");
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(
                (device) => device.kind === "videoinput"
            );

            if (videoDevices.length === 0) {
                setCameras([]);
                setCameraError("No camera was found.");
                return [];
            }

            setCameras(videoDevices);

            // Keep current camera if it still exists
            if (
                !selectedCamera ||
                !videoDevices.some((device) => device.deviceId === selectedCamera)
            ) {
                setSelectedCamera(videoDevices[0].deviceId);
            }

            return videoDevices;
        } catch (error) {
            console.error("Error detecting cameras:", error);
            setCameraError("Unable to detect available cameras.");
            return [];
        }
    }

    async function openCamera(cameraId = null) {
        setCameraError("");
        setCameraLoading(true);

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera API is not supported.");
            }

            // Stop any existing stream first
            stopCamera();

            /*
             * Important:
             * Request camera permission first.
             *
             * This is important because some browsers/Tauri WebView
             * do not expose useful device information until permission
             * has been granted.
             */
            let stream;

            if (cameraId) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: cameraId },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
            }

            streamRef.current = stream;

            // Now enumerate cameras AFTER permission
            const devices = await navigator.mediaDevices.enumerateDevices();

            const videoDevices = devices.filter(
                (device) => device.kind === "videoinput"
            );

            setCameras(videoDevices);

            // Determine which camera is actually being used
            const activeTrack = stream.getVideoTracks()[0];
            const settings = activeTrack?.getSettings();

            const activeCameraId =
                settings?.deviceId ||
                cameraId ||
                videoDevices[0]?.deviceId ||
                "";

            setSelectedCamera(activeCameraId);

            setCameraOpen(true);
            setCameraLoading(false);

            // Attach stream to video
            if (videoRef.current) {
                videoRef.current.srcObject = stream;

                await new Promise((resolve) => {
                    const video = videoRef.current;

                    if (!video) {
                        resolve();
                        return;
                    }

                    if (video.readyState >= 2) {
                        resolve();
                        return;
                    }

                    video.onloadedmetadata = () => resolve();
                });

                await videoRef.current.play();

                // Wait until actual video dimensions are available
                if (videoReadyCheckRef.current) {
                    clearInterval(videoReadyCheckRef.current);
                }

                videoReadyCheckRef.current = setInterval(() => {
                    if (
                        videoRef.current &&
                        videoRef.current.videoWidth > 0 &&
                        videoRef.current.videoHeight > 0
                    ) {
                        clearInterval(videoReadyCheckRef.current);
                        videoReadyCheckRef.current = null;
                    }
                }, 50);
            }
        } catch (error) {
            console.error("Camera error:", error);

            if (error?.name === "NotAllowedError") {
                setCameraError(
                    "Camera permission was denied. Please allow camera access and try again."
                );
            } else if (error?.name === "NotFoundError") {
                setCameraError("No camera was found.");
            } else if (error?.name === "NotReadableError") {
                setCameraError(
                    "The camera is already being used by another application."
                );
            } else if (error?.name === "OverconstrainedError") {
                setCameraError(
                    "The selected camera is not available. Please select another camera."
                );
            } else {
                setCameraError("Unable to access camera.");
            }

            stopCamera();
            setCameraOpen(false);
            setCameraLoading(false);
        }
    }

    async function changeCamera(cameraId) {
        if (!cameraId) return;

        setSelectedCamera(cameraId);
        setCameraError("");

        if (!cameraOpen) {
            return;
        }

        await openCamera(cameraId);
    }

    function stopCamera() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                track.stop();
            });

            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
        }

        if (videoReadyCheckRef.current) {
            clearInterval(videoReadyCheckRef.current);
            videoReadyCheckRef.current = null;
        }
    }

    function closeCamera() {
        stopCamera();

        setCameraOpen(false);
        setCameraLoading(false);
        setIsCameraDropdownOpen(false);
    }

    function takePhoto() {
        const video = videoRef.current;

        if (!video) {
            showError("Camera is not ready.");
            return;
        }

        if (video.readyState < 2) {
            showError("Camera is still starting. Please wait a moment.");
            return;
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
            showError("Camera video is not ready yet. Please try again.");
            return;
        }

        capturePhoto(video);
    }

    function capturePhoto(video) {
        const canvas = document.createElement("canvas");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        if (!context) {
            showError("Unable to capture photo.");
            return;
        }

        context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );

        const image = canvas.toDataURL("image/jpeg", 0.85);

        setDocumentPic(image);

        closeCamera();

        showSuccess("Photo captured successfully!");
    }

    function openFilePicker() {
        fileInputRef.current?.click();
    }

    function handlePhotoUpload(e) {
        const file = e.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showError("Please select an image file.");
            e.target.value = "";
            return;
        }

        const maxSize = 5 * 1024 * 1024;

        if (file.size > maxSize) {
            showError("Photo must be smaller than 5 MB.");
            e.target.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            setDocumentPic(reader.result);
            showSuccess("Photo uploaded successfully!");
        };

        reader.onerror = () => {
            showError("Unable to read the selected photo.");
        };

        reader.readAsDataURL(file);

        e.target.value = "";
    }

    async function retakePhoto() {
        setDocumentPic(null);

        await openCamera(selectedCamera || null);
    }

    function removePhoto() {
        setDocumentPic(null);
        showInfo("Photo removed.");
    }

    // ---------------------------------------------------------
    // SUBMIT CUSTOMER
    // ---------------------------------------------------------

    async function handleSubmit(e) {
        e.preventDefault();

        // Validate form
        if (!validateForm()) {
            // Show first error as message
            const firstError = Object.values(formErrors)[0];
            if (firstError) {
                showError(firstError);
            }
            return;
        }

        const finalNationality = nationality === "Other"
            ? (customNationality.trim() || "Other")
            : nationality;

        setFormLoading(true);
        clearMessages();

        try {
            if (editingId === null) {
                await invoke("add_customer", {
                    customer: {
                        name: name.trim(),
                        address: address.trim() || null,
                        phone_number: phoneNumber.trim(),
                        document_type: documentType || null,
                        document_number: documentNumber.trim() || null,
                        document_pic: documentPic || null,
                        nationality: finalNationality || null,
                    },
                });
                showSuccess("Customer added successfully.");
            } else {
                await invoke("update_customer", {
                    customer: {
                        customer_id: editingId,
                        name: name.trim(),
                        address: address.trim() || null,
                        phone_number: phoneNumber.trim(),
                        document_type: documentType || null,
                        document_number: documentNumber.trim() || null,
                        document_pic: documentPic || null,
                        nationality: finalNationality || null,
                    },
                });
                showSuccess("Customer updated successfully.");
            }

            closeForm();
            await loadCustomers();
        } catch (error) {
            console.error(error);
            showError(String(error));
        } finally {
            setFormLoading(false);
        }
    }

    // ---------------------------------------------------------
    // DELETE CUSTOMER
    // ---------------------------------------------------------

    async function handleDeleteConfirm() {
        if (!deletingCustomer) return;

        setDeleteLoading(true);
        clearMessages();

        try {
            await invoke("delete_customer", {
                customerId: deletingCustomer.customer_id,
            });
            showSuccess(`Customer "${deletingCustomer.name}" deleted successfully.`);
            setShowDeleteConfirm(false);
            setDeletingCustomer(null);
            await loadCustomers();
        } catch (error) {
            console.error(error);
            showError(String(error));
        } finally {
            setDeleteLoading(false);
        }
    }

    // ---------------------------------------------------------
    // OPEN/CLOSE FORM
    // ---------------------------------------------------------

    function openCreateForm() {
        clearForm();
        setFormMode('create');
        setEditingId(null);
        setIsFormVisible(true);
        setFormErrors({});
        clearMessages();
        setTimeout(() => {
            document.getElementById('customer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function openEditForm(customer) {
        setFormMode('edit');
        setEditingId(customer.customer_id);
        setName(customer.name);
        setAddress(customer.address || "");
        setPhoneNumber(customer.phone_number);
        setDocumentType(customer.document_type || "");
        setDocumentNumber(customer.document_number || "");
        setDocumentPic(customer.document_pic || null);
        setFormErrors({});

        const customerNationality = customer.nationality || "Nepali";
        const predefinedNationalities = nationalityOptions.map(opt => opt.value);
        const isCustom = !predefinedNationalities.includes(customerNationality) && customerNationality !== "Other";

        if (isCustom && customerNationality !== "Other") {
            setNationality("Other");
            setCustomNationality(customerNationality);
            setShowCustomNationality(true);
        } else {
            setNationality(customerNationality);
            setCustomNationality("");
            setShowCustomNationality(false);
        }

        setIsFormVisible(true);
        clearMessages();
        setTimeout(() => {
            document.getElementById('customer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function closeForm() {
        stopCamera();
        setCameraOpen(false);
        setIsFormVisible(false);
        setFormMode('create');
        setEditingId(null);
        setName("");
        setAddress("");
        setPhoneNumber("");
        setDocumentType("");
        setDocumentNumber("");
        setDocumentPic(null);
        setNationality("Nepali");
        setCustomNationality("");
        setShowCustomNationality(false);
        setCameraError("");
        setCameras([]);
        setSelectedCamera("");
        setCameraLoading(false);
        setFormErrors({});
        setIsCameraDropdownOpen(false);
        clearMessages();
    }

    function clearForm() {
        closeCamera();
        setCameraOpen(false);
        setEditingId(null);
        setName("");
        setAddress("");
        setPhoneNumber("");
        setDocumentType("");
        setDocumentNumber("");
        setDocumentPic(null);
        setNationality("Nepali");
        setCustomNationality("");
        setShowCustomNationality(false);
        setCameraError("");
        setCameras([]);
        setSelectedCamera("");
        setCameraLoading(false);
        setFormErrors({});
        setIsCameraDropdownOpen(false);
        clearMessages();
    }

    // ---------------------------------------------------------
    // SEARCH
    // ---------------------------------------------------------

    function handleSearchInput(e) {
        setSearchInput(e.target.value);
    }

    function handleSearchSubmit(e) {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
        if (searchInput.trim()) {
            showInfo(`Searching for "${searchInput}"...`);
        }
    }

    function handleClearSearch() {
        setSearchInput("");
        setSearch("");
        setPage(1);
        clearMessages();
    }

    // ---------------------------------------------------------
    // IMAGE PREVIEW
    // ---------------------------------------------------------

    function openImagePreview(imageData, customerName) {
        setPreviewImage(imageData);
        setPreviewCustomerName(customerName);
        setShowImagePreview(true);
    }

    function formatDate(dateString) {
        if (!dateString) return "-";
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    // ---------------------------------------------------------
    // CUSTOM DROPDOWN COMPONENT
    // ---------------------------------------------------------

    function CustomDropdown({ options, value, onChange, placeholder, label, error }) {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = useRef(null);

        useEffect(() => {
            function handleClickOutside(event) {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            }
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const selectedOption = options.find(opt => opt.value === value);
        const displayLabel = selectedOption ? selectedOption.label : placeholder;

        return (
            <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                    {error && <span className="text-red-500 ml-1">*</span>}
                </label>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between hover:border-blue-400 transition-colors ${error ? 'border-red-500' : 'border-gray-300'
                        }`}
                >
                    <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
                        {displayLabel}
                    </span>
                    <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {error && (
                    <p className="mt-1 text-xs text-red-500">{error}</p>
                )}
                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${option.value === value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                    }`}
                            >
                                <span>{option.label}</span>
                                {option.value === value && (
                                    <CheckIcon className="w-4 h-4 text-blue-600" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ---------------------------------------------------------
    // CAMERA DROPDOWN
    // ---------------------------------------------------------

    function CameraDropdown() {
        useEffect(() => {
            function handleClickOutside(event) {
                if (cameraDropdownRef.current && !cameraDropdownRef.current.contains(event.target)) {
                    setIsCameraDropdownOpen(false);
                }
            }
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const selectedCameraObj = cameras.find(c => c.deviceId === selectedCamera);

        return (
            <div className="relative" ref={cameraDropdownRef}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                    Camera
                </label>
                <button
                    type="button"
                    onClick={() => setIsCameraDropdownOpen(!isCameraDropdownOpen)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between hover:border-blue-400 transition-colors"
                >
                    <span className="text-gray-900">
                        {selectedCameraObj?.label || selectedCameraObj?.deviceId || 'Select Camera'}
                    </span>
                    <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isCameraDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCameraDropdownOpen && cameras.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {cameras.map((camera, index) => (
                            <button
                                key={camera.deviceId}
                                type="button"
                                onClick={() => {
                                    changeCamera(camera.deviceId);
                                    setIsCameraDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${camera.deviceId === selectedCamera ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                    }`}
                            >
                                <span>{camera.label || `Camera ${index + 1}`}</span>
                                {camera.deviceId === selectedCamera && (
                                    <CheckIcon className="w-4 h-4 text-blue-600" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ---------------------------------------------------------
    // CLEAN CAMERA
    // ---------------------------------------------------------

    useEffect(() => {
        return () => {
            stopCamera();
            clearMessages();
        };
    }, []);

    // Loading state
    if (loading && customers.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading customers...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto relative">
            {/* Message Display */}
            {messages.length > 0 && (
                <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md w-full">
                    {messages.map(({ id, text, type }) => (
                        <div
                            key={id}
                            className={`
                                p-4 rounded-lg shadow-lg border flex items-start gap-3 animate-slide-in
                                ${type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}
                                ${type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''}
                                ${type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                            `}
                        >
                            <div className="flex-1">
                                <p className="text-sm">{text}</p>
                            </div>
                            <button
                                onClick={() => removeMessage(id)}
                                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage customer information and documents
                    </p>
                </div>
                <button
                    onClick={openCreateForm}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                    <UserPlusIcon className="w-5 h-5" />
                    <span>Add Customer</span>
                </button>
            </div>

            {/* =================================================
                CUSTOMER FORM (Inline Section)
            ================================================= */}

            {isFormVisible && (
                <div id="customer-form" className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {formMode === 'create' ? "Add New Customer" : "Edit Customer"}
                            </h2>
                            <p className="text-sm text-blue-100">
                                {formMode === 'create' ? "Enter customer details" : "Update customer information"}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* NAME */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (formErrors.name) clearFieldError('name');
                                    }}
                                    onBlur={() => {
                                        if (name.trim() && !name.trim().includes(' ')) {
                                            setFormErrors(prev => ({ ...prev, name: 'Please enter full name (first and last name)' }));
                                        } else if (name.trim() && name.trim().split(' ').length < 2) {
                                            setFormErrors(prev => ({ ...prev, name: 'Please enter both first and last name' }));
                                        } else if (formErrors.name) {
                                            clearFieldError('name');
                                        }
                                    }}
                                    placeholder="First and Last Name"
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.name ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    required
                                />
                                {formErrors.name && (
                                    <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-400">Must include first and last name</p>
                            </div>

                            {/* PHONE */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        setPhoneNumber(e.target.value);
                                        if (formErrors.phoneNumber) clearFieldError('phoneNumber');
                                    }}
                                    onBlur={() => {
                                        const digits = phoneNumber.replace(/\D/g, '');
                                        if (phoneNumber.trim() && digits.length < 10) {
                                            setFormErrors(prev => ({ ...prev, phoneNumber: 'Phone number must be at least 10 digits' }));
                                        } else if (phoneNumber.trim() && digits.length > 15) {
                                            setFormErrors(prev => ({ ...prev, phoneNumber: 'Phone number cannot exceed 15 digits' }));
                                        } else if (formErrors.phoneNumber) {
                                            clearFieldError('phoneNumber');
                                        }
                                    }}
                                    placeholder="Phone number"
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    required
                                />
                                {formErrors.phoneNumber && (
                                    <p className="mt-1 text-xs text-red-500">{formErrors.phoneNumber}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-400">Must be at least 10 digits</p>
                            </div>

                            {/* ADDRESS */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Address
                                </label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Address"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* NATIONALITY */}
                            <div>
                                <CustomDropdown
                                    options={nationalityOptions}
                                    value={nationality}
                                    onChange={(value) => {
                                        setNationality(value);
                                        setShowCustomNationality(value === "Other");
                                        if (value !== "Other") {
                                            setCustomNationality("");
                                        }
                                    }}
                                    placeholder="Select nationality"
                                    label="Nationality"
                                />
                                {showCustomNationality && (
                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            value={customNationality}
                                            onChange={(e) => setCustomNationality(e.target.value)}
                                            placeholder="Enter custom nationality..."
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* DOCUMENT TYPE */}
                            <div>
                                <CustomDropdown
                                    options={documentTypeOptions}
                                    value={documentType}
                                    onChange={setDocumentType}
                                    placeholder="Select document"
                                    label="Document Type"
                                />
                            </div>

                            {/* DOCUMENT NUMBER */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Document Number
                                </label>
                                <input
                                    type="text"
                                    value={documentNumber}
                                    onChange={(e) => setDocumentNumber(e.target.value)}
                                    placeholder="Document number"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* PHOTO SECTION */}
                            <div className="md:col-span-2">
                                <div className="border-t border-gray-200 pt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Document Pic
                                    </label>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                    />

                                    {!documentPic && !cameraOpen && (
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await getCameras();
                                                    if (cameras.length > 0) {
                                                        await openCamera();
                                                    } else {
                                                        await getCameras();
                                                        if (cameras.length > 0) {
                                                            await openCamera();
                                                        }
                                                    }
                                                }}
                                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                            >
                                                <CameraIcon className="w-4 h-4" />
                                                Take Photo
                                            </button>

                                            <button
                                                type="button"
                                                onClick={openFilePicker}
                                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                            >
                                                <PhotoIcon className="w-4 h-4" />
                                                Upload Photo
                                            </button>
                                        </div>
                                    )}

                                    {cameraLoading && (
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                            <span className="text-sm text-gray-600">Starting camera...</span>
                                        </div>
                                    )}

                                    {cameraError && !cameraOpen && (
                                        <p className="mt-2 text-sm text-red-600">{cameraError}</p>
                                    )}

                                    {cameraOpen && (
                                        <div className="mt-3">
                                            {cameras.length > 1 && (
                                                <div className="mb-3 max-w-xs">
                                                    <CameraDropdown />
                                                </div>
                                            )}

                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-full max-w-lg rounded-lg bg-black"
                                            />

                                            <div className="flex flex-wrap gap-3 mt-3">
                                                <button
                                                    type="button"
                                                    onClick={takePhoto}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors"
                                                >
                                                    <CameraIcon className="w-4 h-4" />
                                                    Take Photo
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={closeCamera}
                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    <XMarkIcon className="w-4 h-4" />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {documentPic && !cameraOpen && (
                                        <div className="mt-3">
                                            <img
                                                src={documentPic}
                                                alt="Document"
                                                className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                                            />

                                            <div className="flex flex-wrap gap-3 mt-3">
                                                <button
                                                    type="button"
                                                    onClick={retakePhoto}
                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                                >
                                                    <ArrowPathIcon className="w-4 h-4" />
                                                    Retake
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={openFilePicker}
                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                                >
                                                    <PhotoIcon className="w-4 h-4" />
                                                    Change Photo
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={removePhoto}
                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* FORM BUTTONS */}
                        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={formLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {formLoading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{formMode === 'create' ? "Adding..." : "Updating..."}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="w-4 h-4" />
                                        <span>{formMode === 'create' ? "Add Customer" : "Update Customer"}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* =================================================
                SEARCH
            ================================================= */}

            <div className="mb-6">
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={handleSearchInput}
                            placeholder="Search by name, phone, document number or nationality..."
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        <MagnifyingGlassIcon className="w-5 h-5" />
                        <span>Search</span>
                    </button>
                </form>
            </div>

            {/* TOTAL */}
            <div className="mb-4 text-sm text-gray-600">
                Total customers: <span className="font-semibold text-gray-800">{total}</span>
            </div>

            {/* =================================================
                TABLE
            ================================================= */}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Phone
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Address
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Nationality
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Document
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Document Img
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center gap-1">
                                        <ClockIcon className="w-3 h-3" />
                                        Registered
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                                        {search ? "No customers found matching your search." : "No customers found. Add your first customer!"}
                                    </td>
                                </tr>
                            ) : (
                                customers.map((customer) => (
                                    <tr key={customer.customer_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            #{customer.customer_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">
                                                {customer.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {customer.phone_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {customer.address || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {customer.nationality || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {customer.document_type
                                                ? `${customer.document_type}: ${customer.document_number || "-"}`
                                                : "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {customer.document_pic ? (
                                                <button
                                                    onClick={() => openImagePreview(customer.document_pic, customer.name)}
                                                    className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                    View
                                                </button>
                                            ) : (
                                                <span className="text-sm text-gray-400">No pic</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(customer.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditForm(customer)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit customer"
                                                >
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setDeletingCustomer(customer);
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete customer"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* =================================================
                PAGINATION
            ================================================= */}

            {totalPages > 0 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className={`px-4 py-2 rounded-lg transition-colors ${page <= 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Previous
                    </button>

                    <span className="text-sm text-gray-600">
                        Page {page} of {totalPages}
                    </span>

                    <button
                        disabled={page >= totalPages || totalPages === 0}
                        onClick={() => setPage(page + 1)}
                        className={`px-4 py-2 rounded-lg transition-colors ${page >= totalPages || totalPages === 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* =================================================
                DELETE CONFIRMATION MODAL
            ================================================= */}

            {showDeleteConfirm && deletingCustomer && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/20 rounded-full">
                                    <TrashIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        Confirm Deletion
                                    </h2>
                                    <p className="text-sm text-red-100">
                                        This action cannot be undone
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <p className="text-gray-600 mb-2">
                                Are you sure you want to delete this customer?
                            </p>
                            <p className="font-semibold text-gray-800 text-lg mb-2">
                                "{deletingCustomer.name}"
                            </p>
                            {deletingCustomer.nationality && (
                                <p className="text-sm text-gray-500 mb-2">
                                    Nationality: {deletingCustomer.nationality}
                                </p>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                <ClockIcon className="w-4 h-4" />
                                <span>Created: {formatDate(deletingCustomer.created_at)}</span>
                            </div>
                            <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                                ⚠️ This action cannot be undone. All data associated with this customer will be permanently removed.
                            </p>

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeletingCustomer(null);
                                        clearMessages();
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    disabled={deleteLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={deleteLoading}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deleteLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <TrashIcon className="w-4 h-4" />
                                            <span>Delete Customer</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                IMAGE PREVIEW MODAL
            ================================================= */}

            {showImagePreview && previewImage && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => {
                        setShowImagePreview(false);
                        setPreviewImage(null);
                        setPreviewCustomerName("");
                    }}
                >
                    <div
                        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-800">Document Pic</h3>
                                <p className="text-sm text-gray-500">{previewCustomerName}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowImagePreview(false);
                                    setPreviewImage(null);
                                    setPreviewCustomerName("");
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 p-6 flex items-center justify-center overflow-auto bg-gray-50">
                            <img
                                src={previewImage}
                                alt="Document"
                                className="max-w-full max-h-[60vh] object-contain rounded"
                            />
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowImagePreview(false);
                                    setPreviewImage(null);
                                    setPreviewCustomerName("");
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CustomerPage;