import { Camera, Loader2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "../../components";
import { useStore } from "../../context/useStore";
import {
    getProfilePictureUrl,
    updateProfileRequest,
    uploadProfilePictureRequest,
} from "../../services/authService";

const ProfilePage = () => {
    const user = useStore((state) => state.user);
    const setAuth = useStore((state) => state.setAuth);
    const token = useStore((state) => state.token);

    const [firstName, setFirstName] = useState(user?.firstName ?? "");
    const [lastName, setLastName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingPicture, setIsUploadingPicture] = useState(false);
    const [error, setError] = useState("");
    const [pictureVersion, setPictureVersion] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user?.firstName) {
            setFirstName(user.firstName);
        }
    }, [user?.firstName]);

    const profilePictureUrl = user
        ? `${getProfilePictureUrl()}?v=${pictureVersion}`
        : null;

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setError("");

        if (firstName.trim().length < 2) {
            setError("First name must be at least 2 characters.");
            return;
        }

        setIsSubmitting(true);
        try {
            const data: { firstName?: string; lastName?: string } = {
                firstName: firstName.trim(),
            };
            if (lastName.trim().length > 0) {
                data.lastName = lastName.trim();
            }
            const result = await updateProfileRequest(data);
            setAuth(result, token);
            toast.success("Profile updated successfully!");
        } catch (err: unknown) {
            let message = "Failed to update profile.";
            if (err instanceof Error) message = err.message;
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePictureChange = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be smaller than 5 MB.");
            return;
        }

        setIsUploadingPicture(true);
        try {
            await uploadProfilePictureRequest(file);
            setPictureVersion((v) => v + 1);
            toast.success("Profile picture updated!");
        } catch (err: unknown) {
            let message = "Failed to upload picture.";
            if (err instanceof Error) message = err.message;
            toast.error(message);
        } finally {
            setIsUploadingPicture(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const initials = (firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

    return (
        <div className="flex-1 flex flex-col items-center overflow-y-auto p-4 sm:p-6 bg-bg">
            <div className="w-full max-w-[440px] bg-surface border border-border rounded-2xl p-8 shadow-xl animate-in fade-in zoom-in-95 duration-500">
                <BackButton to="/dashboard" label="Back to Dashboard" />

                <h1 className="text-2xl font-bold text-text-strong tracking-tight mb-1">
                    Edit Profile
                </h1>
                <p className="text-[15px] text-text-muted mb-8">
                    Update your personal information and profile picture
                </p>

                <div className="flex flex-col items-center mb-8">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPicture}
                        className="group relative cursor-pointer"
                    >
                        <div className="w-24 h-24 rounded-full bg-accent-subtle border-2 border-border flex items-center justify-center overflow-hidden transition-all group-hover:border-accent">
                            {isUploadingPicture ? (
                                <Loader2
                                    size={28}
                                    className="text-accent animate-spin"
                                />
                            ) : profilePictureUrl ? (
                                <img
                                    src={profilePictureUrl}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (
                                            e.target as HTMLImageElement
                                        ).style.display = "none";
                                    }}
                                />
                            ) : (
                                <span className="text-3xl font-bold text-accent">
                                    {initials}
                                </span>
                            )}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={22} className="text-white" />
                        </div>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handlePictureChange}
                        className="hidden"
                    />
                    <p className="text-xs text-text-muted mt-3">
                        Click to change picture (JPEG or PNG, max 5 MB)
                    </p>
                </div>

                <form
                    onSubmit={handleSaveProfile}
                    className="flex flex-col gap-4"
                >
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="profile-email"
                            className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                        >
                            Email
                        </label>
                        <div className="w-full px-4 py-2.5 bg-bg-muted border border-border rounded-xl text-base text-text-muted flex items-center gap-2">
                            <User size={16} />
                            {user?.email ?? "—"}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label
                                htmlFor="profile-firstName"
                                className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                            >
                                First Name
                            </label>
                            <input
                                id="profile-firstName"
                                type="text"
                                placeholder="First name"
                                value={firstName}
                                onChange={(e) => {
                                    setFirstName(e.target.value);
                                    setError("");
                                }}
                                required
                                className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label
                                htmlFor="profile-lastName"
                                className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                            >
                                Last Name
                            </label>
                            <input
                                id="profile-lastName"
                                type="text"
                                placeholder="Last name"
                                value={lastName}
                                onChange={(e) => {
                                    setLastName(e.target.value);
                                    setError("");
                                }}
                                className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="bg-danger-subtle text-danger border border-danger-border p-3 rounded-lg text-sm font-medium"
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 mt-2 bg-accent text-text-on-accent border-none rounded-xl text-base font-bold shadow-[0_4px_12px_var(--color-accent-glow)] transition-all hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Saving…" : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;
