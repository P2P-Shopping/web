import type React from "react";
import ucartIconLight from "../../assets/ucart-icon.svg";
import ucartIconDark from "../../assets/ucart-icon-dark.svg";
import ucartLogoLight from "../../assets/ucart-logo-text.svg";
import ucartLogoDark from "../../assets/ucart-logo-text-dark.svg";
import { useIsDark } from "../../hooks/useIsDark";

interface LogoProps
    extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
    variant?: "text" | "icon";
}

const Logo: React.FC<LogoProps> = ({
    variant = "text",
    alt,
    className,
    ...props
}) => {
    const isDark = useIsDark();

    const src =
        variant === "text"
            ? isDark
                ? ucartLogoDark
                : ucartLogoLight
            : isDark
              ? ucartIconDark
              : ucartIconLight;

    return (
        <img
            src={src}
            alt={alt || (variant === "text" ? "uCart Logo" : "uCart Icon")}
            className={className}
            {...props}
        />
    );
};

export default Logo;
