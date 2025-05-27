export interface AndroidNotification {
    title?: string;
    body?: string;
    icon?: string;
    color?: string;
    sound?: string;
    tag?: string;
    click_action?: string;
    body_loc_key?: string;
    body_loc_args?: string[];
    title_loc_key?: string;
    title_loc_args?: string[];
    channel_id?: string;
    image?: string;
    ticker?: string;
    sticky?: boolean;
    event_time?: string;
    local_only?: boolean;
    notification_priority?: 'PRIORITY_UNSPECIFIED' | 'PRIORITY_MIN' | 'PRIORITY_LOW' | 'PRIORITY_DEFAULT' | 'PRIORITY_HIGH' | 'PRIORITY_MAX';
    default_sound?: boolean;
    light_settings?: {
        color: string;
        light_on_duration?: string;
        light_off_duration?: string;
    };
    default_light_settings?: boolean;
    default_vibrate_timings?: boolean;
    vibrate_timings?: string[];
    visibility?: 'VISIBILITY_UNSPECIFIED' | 'PRIVATE' | 'PUBLIC' | 'SECRET';
    notification_count?: number;
}

export interface AndroidConfig {
    collapse_key?: string;
    priority?: 'normal' | 'high';
    ttl?: string;
    restricted_package_name?: string;
    data?: { [key: string]: string };
    notification?: AndroidNotification;
    fcm_options?: {
        analytics_label?: string;
    };
    direct_boot_ok?: boolean;
}

export interface ApnsPayload {
    aps: {
        alert?: {
            title?: string;
            subtitle?: string;
            body?: string;
            launch_image?: string;
            title_loc_key?: string;
            title_loc_args?: string[];
            subtitle_loc_key?: string;
            subtitle_loc_args?: string[];
            loc_key?: string;
            loc_args?: string[];
        };
        badge?: number;
        sound?: string | {
            critical?: boolean;
            name?: string;
            volume?: number;
        };
        thread_id?: string;
        category?: string;
        content_available?: boolean;
        mutable_content?: boolean;
        target_content_id?: string;
        interruption_level?: string;
        relevance_score?: number;
        filter_criteria?: string;
        stale_date?: number;
        content_state?: { [key: string]: any };
    };
    [key: string]: any;
}

export interface ApnsConfig {
    headers?: { [key: string]: string };
    payload?: ApnsPayload;
    fcm_options?: {
        analytics_label?: string;
        image?: string;
    };
}

export interface WebpushConfig {
    headers?: { [key: string]: string };
    data?: { [key: string]: string };
    notification?: {
        title?: string;
        body?: string;
        icon?: string;
        badge?: string;
        image?: string;
        actions?: Array<{
            action: string;
            title: string;
            icon?: string;
        }>;
        dir?: 'auto' | 'ltr' | 'rtl';
        lang?: string;
        renotify?: boolean;
        requireInteraction?: boolean;
        silent?: boolean;
        tag?: string;
        timestamp?: number;
        vibrate?: number[];
    };
    fcm_options?: {
        link?: string;
        analytics_label?: string;
    };
}

export interface FcmMessageOptions {
    analytics_label?: string;
}

export interface EnhancedFcmMessage {
    name?: string;
    data?: { [key: string]: string };
    notification?: {
        title: string;
        body: string;
        image?: string;
    };
    android?: AndroidConfig;
    webpush?: WebpushConfig;
    apns?: ApnsConfig;
    fcm_options?: FcmMessageOptions;
} 