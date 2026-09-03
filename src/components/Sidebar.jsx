import { 
    HomeIcon, 
    BuildingOfficeIcon, 
    UserGroupIcon,
    UsersIcon,
    ClipboardDocumentListIcon,
    Cog6ToothIcon,
    UserIcon,
    SparklesIcon,
    ArrowRightOnRectangleIcon,
    Bars3Icon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

function Sidebar({ 
    activePage, 
    setActivePage, 
    isAdmin, 
    username, 
    role, 
    onLogout, 
    children 
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [displayRole, setDisplayRole] = useState(role || 'Loading...');

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Update displayRole when role prop changes
    useEffect(() => {
        if (role) {
            setDisplayRole(role);
        }
    }, [role]);

    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: HomeIcon, adminOnly: false },
        { id: "rooms", label: "Rooms", icon: BuildingOfficeIcon, adminOnly: false },
        { id: "food-services", label: "Food & Services", icon: SparklesIcon, adminOnly: false },
        { id: "customers", label: "Customers", icon: UserGroupIcon, adminOnly: false },
        { id: "room-registration", label: "Room Registration", icon: ClipboardDocumentListIcon, adminOnly: false },
        { id: "staff", label: "Staff", icon: UsersIcon, adminOnly: true },
        { id: "manager-account", label: "Manager Account", icon: Cog6ToothIcon, adminOnly: true },
    ];

    const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    // Format time
    const formattedTime = currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const formattedDate = currentTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Format role for display
    const getDisplayRole = (roleValue) => {
        if (!roleValue) return 'Loading...';
        if (roleValue === 'admin') return 'Administrator';
        if (roleValue === 'staff') return 'Staff Member';
        if (roleValue === 'manager') return 'Manager';
        return roleValue.charAt(0).toUpperCase() + roleValue.slice(1);
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <div 
                className={`
                    bg-gradient-to-b from-blue-800 to-indigo-900 text-white 
                    flex flex-col shadow-xl flex-shrink-0 
                    transition-all duration-300 ease-in-out
                    ${isCollapsed ? 'w-16' : 'w-64'}
                    hidden lg:flex
                    overflow-hidden
                `}
            >
                {/* Brand - Hidden when collapsed */}
                {!isCollapsed && (
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 21V15H16V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 7H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M8 11H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M14 7H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M14 11H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <circle cx="12" cy="18" r="1" fill="currentColor"/>
                            </svg>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Sowl HMS</h1>
                                <p className="text-xs text-blue-200/70">Hotel Management</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleSidebar}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                            title="Collapse sidebar"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Only toggle button when collapsed */}
                {isCollapsed && (
                    <div className="p-3 border-b border-white/10 flex justify-center">
                        <button
                            onClick={toggleSidebar}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                            title="Expand sidebar"
                        >
                            <Bars3Icon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-none">
                    {filteredItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activePage === item.id;
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActivePage(item.id)}
                                title={item.label}
                                className={`
                                    w-full flex items-center 
                                    ${isCollapsed ? 'justify-center' : 'gap-3'} 
                                    px-3 py-2.5 rounded-lg
                                    transition-all duration-200
                                    ${isActive 
                                        ? 'bg-white/20 text-white shadow-lg shadow-black/20' 
                                        : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                
                                {!isCollapsed && (
                                    <span className="text-sm font-medium">{item.label}</span>
                                )}
                                
                                {isActive && !isCollapsed && (
                                    <div className="ml-auto w-1.5 h-6 rounded-full bg-blue-400" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Profile and Logout */}
                <div className="p-3 border-t border-white/10 space-y-2">
                    {/* Profile Button */}
                    <button
                        className={`
                            w-full flex items-center 
                            ${isCollapsed ? 'justify-center' : 'gap-3'} 
                            px-3 py-2 rounded-lg 
                            bg-white/5 hover:bg-white/10 transition-colors
                        `}
                        title={isCollapsed ? 'Profile' : ''}
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        
                        {!isCollapsed && (
                            <div className="flex-1 text-left min-w-0">
                                <p className="text-sm font-medium truncate">{username || 'User'}</p>
                                <p className="text-xs text-blue-200/50 truncate capitalize">
                                    {getDisplayRole(displayRole)}
                                </p>
                            </div>
                        )}
                    </button>

                    {/* Logout Button */}
                    <button
                        onClick={onLogout}
                        className={`
                            w-full flex items-center 
                            ${isCollapsed ? 'justify-center' : 'gap-3'} 
                            px-3 py-2 rounded-lg 
                            bg-red-500/10 hover:bg-red-500/20 
                            text-red-300 hover:text-red-200
                            transition-colors
                        `}
                        title={isCollapsed ? 'Logout' : ''}
                    >
                        <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
                        
                        {!isCollapsed && (
                            <span className="text-sm font-medium">Logout</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            <div 
                className={`
                    fixed inset-0 bg-black/50 z-40
                    transition-opacity duration-300
                    lg:hidden
                    ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
                `}
                onClick={() => setIsCollapsed(true)}
            />

            {/* Mobile Sidebar */}
            <div 
                className={`
                    fixed top-0 left-0 h-full z-50
                    bg-gradient-to-b from-blue-800 to-indigo-900 text-white 
                    flex flex-col shadow-xl
                    transition-transform duration-300 ease-in-out
                    w-64
                    lg:hidden
                    ${isCollapsed ? '-translate-x-full' : 'translate-x-0'}
                    overflow-hidden
                `}
            >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M8 21V15H16V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M8 7H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M8 11H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M14 7H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M14 11H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <circle cx="12" cy="18" r="1" fill="currentColor"/>
                        </svg>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Sowl HMS</h1>
                            <p className="text-xs text-blue-200/70">Hotel Management</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                        title="Close sidebar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-none">
                    {filteredItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activePage === item.id;
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActivePage(item.id);
                                    setIsCollapsed(true);
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                    transition-all duration-200
                                    ${isActive 
                                        ? 'bg-white/20 text-white shadow-lg shadow-black/20' 
                                        : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-6 rounded-full bg-blue-400" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium truncate">{username || 'User'}</p>
                            <p className="text-xs text-blue-200/50 truncate capitalize">
                                {getDisplayRole(displayRole)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 transition-colors"
                    >
                        <ArrowRightOnRectangleIcon className="w-5 h-5" />
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsCollapsed(false)}
                            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Open sidebar"
                        >
                            <Bars3Icon className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">
                                Welcome back, <span className="text-blue-600">{username || 'User'}</span>
                            </h2>
                            <p className="text-xs text-gray-500 capitalize">
                                {getDisplayRole(displayRole)}
                            </p>
                        </div>
                    </div>

                    {/* Right side - Live Date & Time */}
                    <div className="text-right">
                        <p className="text-xl font-semibold text-gray-800">{formattedTime}</p>
                        <p className="text-sm text-gray-500">{formattedDate}</p>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Sidebar;