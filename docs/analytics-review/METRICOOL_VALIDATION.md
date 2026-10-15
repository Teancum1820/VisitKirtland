# Metricool validation

KHG's exact value is 31 ASCII hexadecimal characters: 4510a3f600e674fbd59fa0193b69fe3. It contains no surrounding whitespace, Unicode substitution, or encoding marker. The runtime's existing 32-hex-character rule rejects it. A brand ID is metadata, not a substitute hash. The supplied value remains byte-for-byte unchanged.

| Site | Brand | Exact reported hash | Length | Runtime syntax | Account-generated verification |
|---|---|---|---|---|---|
| KHG | 6874036 | 4510a3f600e674fbd59fa0193b69fe3 | 31 | Rejected | UNVERIFIED |
| Visit | 7369612 | 46026cbfb05c35eaff5c4900bcd965bb | 32 | Accepted in intercepted fixture | UNVERIFIED |
| RTG | 7369575 | 186b8b755be1269fee75993c4c64b16d | 32 | Accepted in intercepted fixture | UNVERIFIED |
| NEOChosen | 7369579 | 1a629a9567d67d551e83d8c4e0081e3d | 32 | Accepted in intercepted fixture | UNVERIFIED |

The authenticated attempt through the available primary Google identity returned user_not_found. There was no authorized account-generated snippet available. [Metricool's official installation guide](https://help.metricool.com/how-to-connect-your-website-or-blog-to-metricool-ejuy1) directs users to copy the generated tag; it does not prove a hash-length contract or the validity of any candidate above. It therefore does not justify accepting 31-character values or padding this value. The actual Metricool account format remains unresolved, rather than declaring Metricool's supplied value intrinsically invalid.

The validator remains strict at 32 hexadecimal characters and now requires a string, preventing JavaScript coercion of arrays/objects. Script URLs are fixed constants; no script markup or arbitrary vendor URL can enter the loader. Configurations explicitly record metricoolVerificationStatus=UNVERIFIED and remain enabled=false / allowLocalTesting=false. Verification labels are documentation metadata, not an alternative to the global activation flag.

Focused tests cover lower/uppercase valid syntax; all three 32-character reported values in synthetic fixtures; KHG's 31-character value; wrong lengths; brand IDs; empty/missing/null values; wrong types; leading/trailing/newline/zero-width whitespace; encoded input; script/URL injection attempts; before-consent and disabled states; missing configuration; one-time initialization; withdrawal and delayed callback suppression. All provider scripts are intercepted. No visit was sent to Metricool and live receipt is NOT VERIFIED.

Resolution status: explicitly blocked pending authoritative tag verification. Joe must obtain the exact brand-generated snippet or Metricool's confirmation of the tag contract. Any later validator change needs that evidence and new security/regression tests. No hash was padded, shortened, replaced or normalized.
