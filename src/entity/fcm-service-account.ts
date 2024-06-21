/**
 * Interface to represent the "service-account.json" file.
 *
 * @author Kenble - f.taddia
 */
export interface FcmServiceAccount {

    type: string;

    project_id: string;

    private_key_id: string;

    private_key: string;

    client_email: string;

    client_id: string;

    auth_uri: string;

    token_uri: string;

    auth_provider_x509_cert_url: string;

    client_x509_cert_url: string;

}
